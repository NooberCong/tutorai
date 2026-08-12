//! StarDict fileset parsing and lookup, free of Tauri.
//!
//! A dictionary is a StarDict fileset (.ifo/.idx/.dict[.dz], optional .syn).
//! [`Fileset::locate`] discovers the siblings of a user-picked .ifo;
//! [`Fileset::load`] parses and validates everything into a ready-to-query
//! [`Dict`]. The whole .dict decompresses into memory (typical files are a
//! few MB; hard cap below) and every headword and synonym goes into a
//! case/diacritic-folded HashMap, so lookups never touch the disk and the
//! .idx sort order — g_ascii_strcasecmp-based and fragile for non-ASCII —
//! is never relied upon.
//!
//! This crate stays free of Tauri so its tests link without the GUI stack:
//! binaries that import comctl32 v6 (via the dialog plugin) need an
//! application manifest and cannot run as plain cargo test harnesses.

use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

/// Decompressed .dict hard cap — defends against decompression bombs.
const MAX_DICT_BYTES: u64 = 512 << 20;
/// Headwords longer than this mean a desynced/corrupt .idx (spec caps at 256).
const MAX_WORD_BYTES: usize = 256;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictMeta {
    pub id: String,
    /// `bookname` from the .ifo.
    pub name: String,
    pub word_count: u32,
    /// `description` from the .ifo — carries a built-in's attribution.
    pub description: String,
    pub builtin: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Definition {
    /// "text" (pre-wrap) or "html" (sanitized by the frontend).
    pub format: String,
    pub body: String,
}

/// A fully loaded, queryable dictionary.
pub struct Dict {
    pub meta: DictMeta,
    entries: Vec<Entry>,
    /// fold(headword | synonym) -> indices into `entries`.
    fold_map: HashMap<String, Vec<u32>>,
    /// Decompressed .dict contents.
    data: Vec<u8>,
    sametypesequence: Option<String>,
}

struct Entry {
    word: String,
    offset: u32,
    size: u32,
}

#[derive(Debug)]
struct Ifo {
    name: String,
    word_count: u32,
    idx_file_size: u64,
    sametypesequence: Option<String>,
    description: String,
}

// ── Filesets ───────────────────────────────────────────────────────────

/// The on-disk files of one dictionary. Normalized layout inside the app's
/// data dir uses fixed names (dict.ifo, dict.idx, …); imports start from
/// wherever the user's files live.
#[derive(Debug)]
pub struct Fileset {
    pub ifo: PathBuf,
    pub idx: PathBuf,
    pub dict: PathBuf,
    pub syn: Option<PathBuf>,
}

impl Fileset {
    /// Discover a fileset from the .ifo the user picked. Siblings share the
    /// .ifo's full stem — Path::with_extension would truncate names that
    /// contain dots, so the suffix is spliced by hand.
    pub fn locate(ifo_path: &str) -> Result<Fileset, String> {
        if !ifo_path.to_ascii_lowercase().ends_with(".ifo") {
            return Err("select the dictionary's .ifo file".into());
        }
        let base = &ifo_path[..ifo_path.len() - 4];
        let idx = PathBuf::from(format!("{base}.idx"));
        if !idx.is_file() {
            if PathBuf::from(format!("{base}.idx.gz")).is_file() {
                return Err(
                    "compressed .idx.gz is not supported — extract it to a plain .idx first".into(),
                );
            }
            return Err("missing .idx file next to the .ifo".into());
        }
        let dict = [format!("{base}.dict.dz"), format!("{base}.dict")]
            .into_iter()
            .map(PathBuf::from)
            .find(|p| p.is_file())
            .ok_or("missing .dict or .dict.dz file next to the .ifo")?;
        let syn = Some(PathBuf::from(format!("{base}.syn"))).filter(|p| p.is_file());
        Ok(Fileset { ifo: PathBuf::from(ifo_path), idx, dict, syn })
    }

    /// The fileset already laid out under fixed names in `dir`.
    pub fn in_dir(dir: &Path) -> Fileset {
        let dz = dir.join("dict.dict.dz");
        Fileset {
            ifo: dir.join("dict.ifo"),
            idx: dir.join("dict.idx"),
            dict: if dz.is_file() { dz } else { dir.join("dict.dict") },
            syn: Some(dir.join("dict.syn")).filter(|p| p.is_file()),
        }
    }

    /// Normalized file name the .dict file gets when copied into the app.
    pub fn dict_file_name(&self) -> &'static str {
        if self.dict.extension().is_some_and(|e| e == "dz") {
            "dict.dict.dz"
        } else {
            "dict.dict"
        }
    }

    /// Parse and validate the whole fileset into a queryable dictionary.
    pub fn load(&self, id: &str, builtin: bool) -> Result<Dict, String> {
        let ifo_text = fs::read_to_string(&self.ifo).map_err(|e| e.to_string())?;
        let ifo = parse_ifo(&ifo_text)?;
        let idx = fs::read(&self.idx).map_err(|e| e.to_string())?;
        let raw = fs::read(&self.dict).map_err(|e| e.to_string())?;
        let data = if self.dict.extension().is_some_and(|e| e == "dz") {
            gunzip_capped(&raw)?
        } else {
            raw
        };
        let syn = match &self.syn {
            Some(path) => Some(fs::read(path).map_err(|e| e.to_string())?),
            None => None,
        };
        assemble(id, builtin, ifo, &idx, data, syn.as_deref())
    }
}

/// Metadata only — parses just the .ifo, cheap enough to run per directory
/// on every listing.
pub fn read_meta(dir: &Path, id: &str, builtin: bool) -> Result<DictMeta, String> {
    let text = fs::read_to_string(dir.join("dict.ifo")).map_err(|e| e.to_string())?;
    let ifo = parse_ifo(&text)?;
    Ok(DictMeta {
        id: id.to_string(),
        name: ifo.name,
        word_count: ifo.word_count,
        description: ifo.description,
        builtin,
    })
}

/// dictzip is plain gzip with an extra random-access field a whole-file
/// decode can ignore; the cap defends against decompression bombs.
fn gunzip_capped(raw: &[u8]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let mut decoder = flate2::read::GzDecoder::new(raw).take(MAX_DICT_BYTES + 1);
    decoder
        .read_to_end(&mut out)
        .map_err(|e| format!("bad .dict.dz: {e}"))?;
    if out.len() as u64 > MAX_DICT_BYTES {
        return Err("dictionary too large (over 512 MB decompressed)".into());
    }
    Ok(out)
}

// ── Parsing ────────────────────────────────────────────────────────────

fn parse_ifo(text: &str) -> Result<Ifo, String> {
    let mut lines = text.lines();
    if lines.next().map(str::trim) != Some("StarDict's dict ifo file") {
        return Err("not a StarDict .ifo file".into());
    }
    let mut name = None;
    let mut word_count = None;
    let mut idx_file_size = None;
    let mut sametypesequence = None;
    let mut description = String::new();
    for line in lines {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        match key.trim() {
            "bookname" => name = Some(value.trim().to_string()),
            "wordcount" => {
                word_count = Some(value.trim().parse::<u32>().map_err(|_| "bad wordcount")?)
            }
            "idxfilesize" => {
                idx_file_size = Some(value.trim().parse::<u64>().map_err(|_| "bad idxfilesize")?)
            }
            "sametypesequence" => sametypesequence = Some(value.trim().to_string()),
            // .ifo line breaks are encoded as <br>.
            "description" => description = value.trim().replace("<br>", "\n"),
            "idxoffsetbits" if value.trim() == "64" => {
                return Err("64-bit .idx offsets are not supported".into());
            }
            _ => {}
        }
    }
    Ok(Ifo {
        name: name.ok_or("missing bookname in .ifo")?,
        word_count: word_count.ok_or("missing wordcount in .ifo")?,
        idx_file_size: idx_file_size.ok_or("missing idxfilesize in .ifo")?,
        sametypesequence,
        description,
    })
}

/// .idx layout: repeated (headword NUL, u32 BE offset, u32 BE size).
fn parse_idx(bytes: &[u8]) -> Result<Vec<Entry>, String> {
    let mut entries = Vec::new();
    let mut pos = 0usize;
    while pos < bytes.len() {
        let nul = bytes[pos..]
            .iter()
            .position(|&b| b == 0)
            .ok_or("truncated .idx: unterminated headword")?;
        if nul > MAX_WORD_BYTES {
            return Err("corrupt .idx: headword longer than 256 bytes".into());
        }
        let word = std::str::from_utf8(&bytes[pos..pos + nul])
            .map_err(|_| "corrupt .idx: headword is not UTF-8")?
            .to_string();
        pos += nul + 1;
        if pos + 8 > bytes.len() {
            return Err("truncated .idx: missing offset/size".into());
        }
        let offset = u32::from_be_bytes(bytes[pos..pos + 4].try_into().unwrap());
        let size = u32::from_be_bytes(bytes[pos + 4..pos + 8].try_into().unwrap());
        pos += 8;
        entries.push(Entry { word, offset, size });
    }
    Ok(entries)
}

/// .syn layout: repeated (synonym NUL, u32 BE index into the .idx entries).
fn parse_syn(bytes: &[u8], entry_count: usize) -> Result<Vec<(String, u32)>, String> {
    let mut pairs = Vec::new();
    let mut pos = 0usize;
    while pos < bytes.len() {
        let nul = bytes[pos..]
            .iter()
            .position(|&b| b == 0)
            .ok_or("truncated .syn: unterminated word")?;
        if nul > MAX_WORD_BYTES {
            return Err("corrupt .syn: word longer than 256 bytes".into());
        }
        let word = std::str::from_utf8(&bytes[pos..pos + nul])
            .map_err(|_| "corrupt .syn: word is not UTF-8")?
            .to_string();
        pos += nul + 1;
        if pos + 4 > bytes.len() {
            return Err("truncated .syn: missing entry index".into());
        }
        let index = u32::from_be_bytes(bytes[pos..pos + 4].try_into().unwrap());
        pos += 4;
        if index as usize >= entry_count {
            return Err("corrupt .syn: entry index out of range".into());
        }
        pairs.push((word, index));
    }
    Ok(pairs)
}

/// Split one entry's data block into displayable definitions.
///
/// With `sametypesequence` the type bytes are omitted from the data and the
/// last field runs to the end of the block; without it every field carries
/// its own leading type byte. Lowercase types are NUL-terminated strings,
/// uppercase ones are u32-BE-size-prefixed blobs.
fn parse_fields(block: &[u8], sts: Option<&str>) -> Vec<Definition> {
    fn take(block: &[u8], pos: &mut usize, out: &mut Vec<Definition>, ty: char, last_of_seq: bool) {
        let content: &[u8] = if last_of_seq {
            let c = &block[*pos..];
            *pos = block.len();
            c
        } else if ty.is_ascii_uppercase() {
            if *pos + 4 > block.len() {
                *pos = block.len();
                return;
            }
            let size = u32::from_be_bytes(block[*pos..*pos + 4].try_into().unwrap()) as usize;
            *pos += 4;
            let end = (*pos + size).min(block.len());
            let c = &block[*pos..end];
            *pos = end;
            c
        } else {
            let end = block[*pos..]
                .iter()
                .position(|&b| b == 0)
                .map(|p| *pos + p)
                .unwrap_or(block.len());
            let c = &block[*pos..end];
            *pos = (end + 1).min(block.len());
            c
        };
        let format = match ty {
            'h' | 'g' | 'x' => "html", // html / pango / xdxf — tag-shaped, sanitized in the UI
            'm' | 'l' | 't' | 'y' | 'k' | 'w' | 'e' | 'n' | 'o' => "text",
            _ => return, // binary payloads (images, audio, resources) — nothing to show
        };
        let body = String::from_utf8_lossy(content).trim().to_string();
        if !body.is_empty() {
            out.push(Definition { format: format.into(), body });
        }
    }

    let mut out = Vec::new();
    let mut pos = 0usize;
    match sts {
        Some(seq) => {
            let types: Vec<char> = seq.chars().collect();
            for (i, &ty) in types.iter().enumerate() {
                if pos >= block.len() {
                    break;
                }
                take(block, &mut pos, &mut out, ty, i + 1 == types.len());
            }
        }
        None => {
            while pos < block.len() {
                let ty = block[pos] as char;
                pos += 1;
                take(block, &mut pos, &mut out, ty, false);
            }
        }
    }
    out
}

// ── Normalization ──────────────────────────────────────────────────────

/// Lookup key: lowercase, ligatures expanded, combining marks stripped —
/// the same folding the reader's text search applies (searchCore.ts).
fn fold(s: &str) -> String {
    use unicode_normalization::UnicodeNormalization;
    s.nfkd()
        .filter(|c| !unicode_normalization::char::is_combining_mark(*c))
        .flat_map(char::to_lowercase)
        .collect()
}

/// PDF selections carry soft hyphens, newlines, and clinging punctuation.
pub fn normalize_query(s: &str) -> String {
    let cleaned: String = s.chars().filter(|&c| c != '\u{00AD}').collect();
    let collapsed = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    collapsed
        .trim_matches(|c: char| !c.is_alphanumeric())
        .to_string()
}

/// Cheap inflection candidates, tried only after direct lookups miss.
/// A fixed suffix list covers the common English cases (walked, running,
/// boxes, flies, book's) without dragging in a stemmer.
fn stem_candidates(word: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let push = |cand: String, out: &mut Vec<String>| {
        if cand.chars().count() >= 2 && cand != word && !out.contains(&cand) {
            out.push(cand);
        }
    };
    for possessive in ["'s", "\u{2019}s"] {
        if let Some(base) = word.strip_suffix(possessive) {
            push(base.to_string(), &mut out);
        }
    }
    if let Some(base) = word.strip_suffix("ies") {
        push(format!("{base}y"), &mut out);
    }
    if let Some(base) = word.strip_suffix("es") {
        push(base.to_string(), &mut out);
    }
    if let Some(base) = word.strip_suffix('s') {
        push(base.to_string(), &mut out);
    }
    for suffix in ["ed", "ing"] {
        if let Some(base) = word.strip_suffix(suffix) {
            push(base.to_string(), &mut out);
            push(format!("{base}e"), &mut out); // moved → move, making → make
            let b = base.as_bytes();
            if b.len() >= 2 && b[b.len() - 1] == b[b.len() - 2] {
                push(base[..base.len() - 1].to_string(), &mut out); // running → run
            }
        }
    }
    out
}

// ── Assembly and lookup ────────────────────────────────────────────────

/// Build a ready-to-query dictionary from parsed file contents, validating
/// cross-file consistency so corrupt filesets fail at import, not at lookup.
fn assemble(
    id: &str,
    builtin: bool,
    ifo: Ifo,
    idx: &[u8],
    data: Vec<u8>,
    syn: Option<&[u8]>,
) -> Result<Dict, String> {
    if idx.len() as u64 != ifo.idx_file_size {
        return Err("corrupt dictionary: .idx size does not match the .ifo".into());
    }
    let entries = parse_idx(idx)?;
    if entries.len() != ifo.word_count as usize {
        return Err("corrupt dictionary: entry count does not match the .ifo".into());
    }
    let needed = entries
        .iter()
        .map(|e| e.offset as u64 + e.size as u64)
        .max()
        .unwrap_or(0);
    if (data.len() as u64) < needed {
        return Err("corrupt dictionary: .dict is shorter than the .idx expects".into());
    }
    let mut fold_map: HashMap<String, Vec<u32>> = HashMap::new();
    for (i, entry) in entries.iter().enumerate() {
        fold_map.entry(fold(&entry.word)).or_default().push(i as u32);
    }
    if let Some(bytes) = syn {
        for (word, index) in parse_syn(bytes, entries.len())? {
            let indices = fold_map.entry(fold(&word)).or_default();
            if !indices.contains(&index) {
                indices.push(index);
            }
        }
    }
    Ok(Dict {
        meta: DictMeta {
            id: id.to_string(),
            name: ifo.name,
            word_count: ifo.word_count,
            description: ifo.description,
            builtin,
        },
        entries,
        fold_map,
        data,
        sametypesequence: ifo.sametypesequence,
    })
}

impl Dict {
    /// Resolve a normalized query to (headword, definitions) groups.
    /// Fallback ladder: folded query → first token → suffix-stripped stems.
    /// Exact-case headword matches sort first; a group per distinct headword
    /// so "March" and "march" stay separate hits.
    pub fn hits(&self, query: &str) -> Vec<(String, Vec<Definition>)> {
        let folded = fold(query);
        let mut candidates = vec![folded.clone()];
        let first = folded.split_whitespace().next().unwrap_or("").to_string();
        if !first.is_empty() && first != folded {
            candidates.push(first.clone());
        }
        candidates.extend(stem_candidates(if first.is_empty() { &folded } else { &first }));
        for candidate in &candidates {
            if let Some(indices) = self.fold_map.get(candidate) {
                let groups = self.collect(indices, query);
                if !groups.is_empty() {
                    return groups;
                }
            }
        }
        Vec::new()
    }

    fn collect(&self, indices: &[u32], query: &str) -> Vec<(String, Vec<Definition>)> {
        let mut groups: Vec<(String, Vec<Definition>)> = Vec::new();
        for &i in indices {
            let entry = &self.entries[i as usize];
            let block = &self.data[entry.offset as usize..(entry.offset + entry.size) as usize];
            let defs = parse_fields(block, self.sametypesequence.as_deref());
            if defs.is_empty() {
                continue;
            }
            match groups.iter_mut().find(|(word, _)| word == &entry.word) {
                Some((_, existing)) => existing.extend(defs),
                None => groups.push((entry.word.clone(), defs)),
            }
        }
        groups.sort_by_key(|(word, _)| word.as_str() != query);
        groups
    }
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn idx_bytes(entries: &[(&str, u32, u32)]) -> Vec<u8> {
        let mut out = Vec::new();
        for (word, offset, size) in entries {
            out.extend_from_slice(word.as_bytes());
            out.push(0);
            out.extend_from_slice(&offset.to_be_bytes());
            out.extend_from_slice(&size.to_be_bytes());
        }
        out
    }

    fn syn_bytes(pairs: &[(&str, u32)]) -> Vec<u8> {
        let mut out = Vec::new();
        for (word, index) in pairs {
            out.extend_from_slice(word.as_bytes());
            out.push(0);
            out.extend_from_slice(&index.to_be_bytes());
        }
        out
    }

    fn ifo_text(word_count: usize, idx_len: usize, extra: &str) -> String {
        format!(
            "StarDict's dict ifo file\nversion=3.0.0\nbookname=Test\nwordcount={word_count}\nidxfilesize={idx_len}\n{extra}"
        )
    }

    /// A sametypesequence=m dictionary whose entries' definitions are the
    /// given strings, laid out back to back in the .dict.
    fn text_dict(words: &[(&str, &str)], syn: Option<&[(&str, u32)]>) -> Dict {
        let mut data = Vec::new();
        let mut entries = Vec::new();
        for (word, def) in words {
            entries.push((*word, data.len() as u32, def.len() as u32));
            data.extend_from_slice(def.as_bytes());
        }
        let idx = idx_bytes(&entries);
        let ifo = parse_ifo(&ifo_text(words.len(), idx.len(), "sametypesequence=m\n")).unwrap();
        let syn = syn.map(syn_bytes);
        assemble("test1", false, ifo, &idx, data, syn.as_deref()).unwrap()
    }

    fn words(hits: &[(String, Vec<Definition>)]) -> Vec<&str> {
        hits.iter().map(|(w, _)| w.as_str()).collect()
    }

    #[test]
    fn ifo_parses_fields() {
        let ifo =
            parse_ifo(&ifo_text(7, 99, "sametypesequence=h\ndescription=line1<br>line2\n")).unwrap();
        assert_eq!(ifo.name, "Test");
        assert_eq!(ifo.word_count, 7);
        assert_eq!(ifo.idx_file_size, 99);
        assert_eq!(ifo.sametypesequence.as_deref(), Some("h"));
        assert_eq!(ifo.description, "line1\nline2");
    }

    #[test]
    fn ifo_rejects_missing_magic() {
        assert!(parse_ifo("bookname=X\nwordcount=1\nidxfilesize=1\n").is_err());
    }

    #[test]
    fn ifo_rejects_64bit_offsets() {
        let err = parse_ifo(&ifo_text(1, 1, "idxoffsetbits=64\n")).unwrap_err();
        assert!(err.contains("64-bit"));
    }

    #[test]
    fn idx_roundtrip() {
        let entries = parse_idx(&idx_bytes(&[("alpha", 0, 5), ("beta", 5, 7)])).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].word, "alpha");
        assert_eq!(entries[1].offset, 5);
        assert_eq!(entries[1].size, 7);
    }

    #[test]
    fn idx_rejects_trailing_garbage() {
        let mut bytes = idx_bytes(&[("alpha", 0, 5)]);
        bytes.extend_from_slice(b"junk");
        assert!(parse_idx(&bytes).is_err());
    }

    #[test]
    fn idx_rejects_invalid_utf8() {
        let mut bytes = vec![0xFF, 0xFE, 0x00];
        bytes.extend_from_slice(&[0, 0, 0, 0, 0, 0, 0, 5]);
        assert!(parse_idx(&bytes).is_err());
    }

    #[test]
    fn fields_with_sametypesequence() {
        let defs = parse_fields(b"plain definition", Some("m"));
        assert_eq!(
            defs,
            vec![Definition { format: "text".into(), body: "plain definition".into() }]
        );
    }

    #[test]
    fn fields_typed_without_sequence() {
        let block = b"mfirst\0h<b>second</b>\0";
        let defs = parse_fields(block, None);
        assert_eq!(defs.len(), 2);
        assert_eq!((defs[0].format.as_str(), defs[0].body.as_str()), ("text", "first"));
        assert_eq!((defs[1].format.as_str(), defs[1].body.as_str()), ("html", "<b>second</b>"));
    }

    #[test]
    fn fields_skip_binary_payloads() {
        // 'W' (audio) is size-prefixed and skipped; the 'm' after it survives.
        let mut block: Vec<u8> = vec![b'W'];
        block.extend_from_slice(&4u32.to_be_bytes());
        block.extend_from_slice(&[1, 2, 3, 4]);
        block.extend_from_slice(b"mtext def\0");
        let defs = parse_fields(&block, None);
        assert_eq!(defs.len(), 1);
        assert_eq!(defs[0].body, "text def");
    }

    #[test]
    fn assemble_rejects_wordcount_mismatch() {
        let idx = idx_bytes(&[("alpha", 0, 3)]);
        let ifo = parse_ifo(&ifo_text(2, idx.len(), "")).unwrap();
        assert!(assemble("x", false, ifo, &idx, b"abc".to_vec(), None).is_err());
    }

    #[test]
    fn assemble_rejects_short_dict_data() {
        let idx = idx_bytes(&[("alpha", 0, 10)]);
        let ifo = parse_ifo(&ifo_text(1, idx.len(), "")).unwrap();
        assert!(assemble("x", false, ifo, &idx, b"abc".to_vec(), None).is_err());
    }

    #[test]
    fn lookup_exact_case_ranks_first() {
        let dict = text_dict(&[("march", "to walk"), ("March", "the month")], None);
        let hits = dict.hits("March");
        assert_eq!(words(&hits), vec!["March", "march"]);
        assert_eq!(hits[0].1[0].body, "the month");
    }

    #[test]
    fn lookup_folds_case_and_diacritics() {
        let dict = text_dict(&[("café", "coffee house")], None);
        assert_eq!(words(&dict.hits("CAFE")), vec!["café"]);
    }

    #[test]
    fn lookup_stems_inflections() {
        let dict = text_dict(&[("run", "move fast"), ("make", "create")], None);
        assert_eq!(words(&dict.hits("running")), vec!["run"]);
        assert_eq!(words(&dict.hits("making")), vec!["make"]);
        assert_eq!(words(&dict.hits("runs")), vec!["run"]);
    }

    #[test]
    fn lookup_falls_back_to_first_token() {
        let dict = text_dict(&[("run", "move fast")], None);
        assert_eq!(words(&dict.hits("run quickly home")), vec!["run"]);
    }

    #[test]
    fn lookup_resolves_synonyms() {
        let dict = text_dict(&[("run", "move fast"), ("book", "pages")], Some(&[("sprint", 0)]));
        assert_eq!(words(&dict.hits("sprint")), vec!["run"]);
    }

    #[test]
    fn lookup_merges_same_headword_entries() {
        let dict = text_dict(&[("bank", "river edge"), ("bank", "money house")], None);
        let hits = dict.hits("bank");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].1.len(), 2);
    }

    #[test]
    fn query_normalization() {
        assert_eq!(normalize_query("  “word.”  "), "word");
        assert_eq!(normalize_query("hy\u{00AD}phen"), "hyphen");
        assert_eq!(normalize_query("two\n words"), "two words");
    }

    #[test]
    fn stem_candidate_list() {
        assert_eq!(stem_candidates("running"), vec!["runn", "runne", "run"]);
        assert!(stem_candidates("flies").contains(&"fly".to_string()));
        assert!(stem_candidates("book's").contains(&"book".to_string()));
        assert!(stem_candidates("moved").contains(&"move".to_string()));
    }

    /// The import path end to end on disk: sibling discovery from a picked
    /// .ifo (dotted stem included) and a full load of the located fileset.
    #[test]
    fn fileset_locates_and_loads_from_disk() {
        let dir = std::env::temp_dir().join(format!("stardict-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let data = b"a fruit".to_vec();
        let idx = idx_bytes(&[("apple", 0, data.len() as u32)]);
        let stem = dir.join("oxford.v2");
        fs::write(stem.with_file_name("oxford.v2.ifo"), ifo_text(1, idx.len(), "sametypesequence=m\n")).unwrap();
        fs::write(stem.with_file_name("oxford.v2.idx"), &idx).unwrap();
        fs::write(stem.with_file_name("oxford.v2.dict"), &data).unwrap();

        let fileset = Fileset::locate(&stem.with_file_name("oxford.v2.ifo").to_string_lossy()).unwrap();
        assert!(fileset.idx.ends_with("oxford.v2.idx"), "dotted stems must survive");
        assert_eq!(fileset.dict_file_name(), "dict.dict");
        assert!(fileset.syn.is_none());

        let dict = fileset.load("test", false).unwrap();
        assert_eq!(dict.meta.word_count, 1);
        assert_eq!(dict.hits("apple")[0].1[0].body, "a fruit");

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn fileset_locate_rejects_incomplete_sets() {
        let dir = std::env::temp_dir().join(format!("stardict-test-inc-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let ifo = dir.join("lone.ifo");
        fs::write(&ifo, "x").unwrap();
        let err = Fileset::locate(&ifo.to_string_lossy()).unwrap_err();
        assert!(err.contains(".idx"));
        fs::remove_dir_all(&dir).unwrap();
    }
}

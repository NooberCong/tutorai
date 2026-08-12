//! Load a normalized dictionary dir and query it — dev sanity tool.
//!
//!     cargo run -p stardict --example lookup -- <dir> <word>

use stardict::Fileset;

fn main() {
    let mut args = std::env::args().skip(1);
    let (dir, word) = (args.next().expect("dir"), args.next().expect("word"));
    let dict = Fileset::in_dir(dir.as_ref()).load("cli", false).expect("load");
    println!(
        "{} — {} words\n{}\n",
        dict.meta.name, dict.meta.word_count, dict.meta.description
    );
    for (headword, definitions) in dict.hits(&stardict::normalize_query(&word)) {
        println!("== {headword} ==");
        for def in definitions {
            println!("[{}] {}", def.format, def.body);
        }
    }
}

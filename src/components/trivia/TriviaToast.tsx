/** Says so when today's trivia has just been written, wherever the player
 *  is; clicking it opens Trivia. Never shown on Trivia itself — the pack
 *  appears there in place. */

import { useEffect } from "react";
import { dismissFreshTrivia, useFreshTrivia } from "../../lib/trivia/daily";
import { packFor } from "../../lib/trivia/game";
import { useTrivia } from "../../lib/trivia/store";
import { ChevronRight, Close } from "../Icons";
import { topicList } from "./TriviaScreen";

const SHOW_MS = 20_000;

export function TriviaToast(props: { onTrivia: boolean; onOpen: () => void }) {
  const day = useFreshTrivia();
  const trivia = useTrivia();
  const pack = day ? packFor(trivia, day) : undefined;
  const { onTrivia } = props;

  useEffect(() => {
    if (!day) return;
    if (onTrivia) {
      dismissFreshTrivia();
      return;
    }
    const timer = window.setTimeout(dismissFreshTrivia, SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [day, onTrivia]);

  if (!pack || onTrivia) return null;
  return (
    <div className="trivia-toast" role="status">
      <button
        className="trivia-toast-open"
        onClick={() => {
          dismissFreshTrivia();
          props.onOpen();
        }}
      >
        <b>Today's trivia is ready</b>
        <span>{topicList(pack)}</span>
        <ChevronRight />
      </button>
      <button className="trivia-toast-close" title="Dismiss" aria-label="Dismiss" onClick={dismissFreshTrivia}>
        <Close />
      </button>
    </div>
  );
}

import { Link } from "@remix-run/react";
import { formatDistance } from "date-fns";
import { FC } from "react";
import { CardImage } from "~/components/altered/CardImage";
import { DisplayUniqueCard } from "~/models/cards";

export interface ResultGridProps {
  results: DisplayUniqueCard[]
  now: Date
}

export const ResultGrid: FC<ResultGridProps> = ({ results, now }) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {results.map((result) => (
        <Result key={result.ref} result={result} now={now} />
      ))}
    </div>
  )
}

export const Result: FC<{ result: DisplayUniqueCard, now: Date }> = ({ result, now }) => {
  return (
    <div className="rounded-lg p-2 bg-subtle-background flex flex-row gap-4">
      <div className="flex-1">
        <CardImage card={result} className="rounded-alt-card" />
        <div className="text-subtle-foreground">
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-between">
        <div className="pb-2 flex flex-row gap-2 justify-between">
          <div>
            <div className="font-bold text-lg">
              {result.lastSeenInSalePrice}&euro;
            </div>
            <div className="text-xs text-subtle-foreground">
              {formatLastSeen(result.lastSeenInSaleAt, now)}
            </div>
          </div>
          <div>
            <Link to={`https://www.altered.gg/cards/${result.ref}`}>
              View on Altered
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {result.mainEffect && <div className="text-sm">{result.mainEffect}</div>}
          {result.mainEffect && result.echoEffect && (
            <hr className="border-subtle-foreground border-b-1" />
          )}
          {result.echoEffect && <div className="text-xs">{result.echoEffect}</div>}
        </div>
        <div className="grow-0"></div>
      </div>
    </div>
  );
}

function formatLastSeen(lastSeenInSaleAt: string | undefined, now: Date): string | null {
  if (!lastSeenInSaleAt) return null
  const date = new Date(lastSeenInSaleAt)
  const fmtDiff = formatDistance(date, now, { addSuffix: true, includeSeconds: false })
  return fmtDiff
}


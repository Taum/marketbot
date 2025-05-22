import { Link } from "@remix-run/react";
import { formatDistance } from "date-fns";
import { FC } from "react";
import { CardImage } from "~/components/altered/CardImage";
import { AbilityPartType, DisplayAbilityOnCard, DisplayAbilityPartOnCard, DisplayUniqueCard } from "~/models/cards";

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
          {result.mainEffect && <div className="text-sm">{result.mainAbilities ? formatMainEffect(result.mainEffect, result.mainAbilities) : result.mainEffect}</div>}
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

function formatMainEffect(mainEffect: string, abilities: DisplayAbilityOnCard[]): JSX.Element {
  return <div className="flex flex-col gap-2 text-sm/4">
    {abilities.map((ability, index) => {
      return <div key={index}>
        {formatAbility(ability)}
      </div>
    })}
  </div>
}

function formatAbility({ text, parts }: DisplayAbilityOnCard): JSX.Element {
  let res: JSX.Element[] = []
  let k = 0;
  res.push(<span key={k++}>{text.slice(0, parts[0].startIndex)}</span>);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && parts[i].startIndex != parts[i - 1].endIndex) {
      res.push(<span key={k++}>{text.slice(parts[i - 1].endIndex, parts[i].startIndex)}</span>);
    }
    let classes: string
    let textSlice = text.slice(parts[i].startIndex, parts[i].endIndex)
    switch (parts[i].partType) {
      case AbilityPartType.Trigger:
        classes = "text-cyan-300"
        break
      case AbilityPartType.Condition:
        classes = "text-green-300"
        break
      case AbilityPartType.Effect:
        classes = "text-red-300"
        break
      default:
        classes = ""
    }
    if (textSlice == "[]") {
      textSlice = ""
    }
    res.push(<span key={k++} className={classes} title={"@" + parts[i].id}>{textSlice}</span>);
  }
  res.push(<span key={k++}>{text.slice(parts[parts.length - 1].endIndex)}</span>);
  return <>{res}</>
}

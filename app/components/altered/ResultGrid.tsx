import { Link, useSearchParams } from "@remix-run/react";
import { formatDistance } from "date-fns";
import { FC, useCallback } from "react";
import { AlteredIcon, AlteredIconType } from "~/components/altered/AlteredIcon";
import { CardImage } from "~/components/altered/CardImage";
import { useTranslation } from "~/lib/i18n";
import { AbilityPartType, DisplayAbilityOnCard, DisplayPartOnCard, DisplayUniqueCard } from "~/models/cards";

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
  const { t } = useTranslation();
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
              {t('viewOnAltered')}
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {result.mainEffect && <div className="text-sm">{result.mainAbilities ? formatEffect(result.mainAbilities) : result.mainEffect}</div>}
          {result.mainEffect && result.echoEffect && (
            <hr className="border-subtle-foreground border-b-1" />
          )}
          {result.echoEffect && <div className="text-xs">{result.mainAbilities ? formatSupport(result.mainAbilities) : result.echoEffect}</div>}
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

function formatEffect(abilities: DisplayAbilityOnCard[]): JSX.Element {
  const abilitiesToFormat = abilities.filter((a) => !a.isSupport)
  return <div className="flex flex-col gap-2 text-sm/4">
    {abilitiesToFormat.map((ability, index) => {
      return <div key={index}>
        {formatAbility(ability)}
      </div>
    })}
  </div>
}

function formatSupport(abilities: DisplayAbilityOnCard[]): JSX.Element {
  const abilitiesToFormat = abilities.filter((a) => a.isSupport)
  return <div className="flex flex-col gap-2 text-xs/4">
    {abilitiesToFormat.map((ability, index) => {
      return <div key={index}>
        {formatAbility(ability)}
      </div>
    })}
  </div>
}

function formatAbility(ability: DisplayAbilityOnCard): JSX.Element {
  const { text, parts } = ability
  let res: JSX.Element[] = []
  let k = 0;
  if (parts.length == 0) {
    return <span>{text}</span>
  }
  res.push(<span key={k++}>{text.slice(0, parts[0].startIndex)}</span>);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0 && parts[i].startIndex != parts[i - 1].endIndex) {
      res.push(<span key={k++}>{findReplaceSymbols(text.slice(parts[i - 1].endIndex, parts[i].startIndex))}</span>);
    }
    let textSlice = text.slice(parts[i].startIndex, parts[i].endIndex)
    res.push(<AbilityLink key={k++} part={parts[i]} ability={ability}>{textSlice}</AbilityLink>);
  }
  res.push(<span key={k++}>{findReplaceSymbols(text.slice(parts[parts.length - 1].endIndex))}</span>);
  return <>{res}</>
}

export function findReplaceSymbols(text: string): JSX.Element {

  const underlinedKeywordClasses = "font-extrabold underline underline-offset-1"
  const keywordClasses = "font-extrabold"

  const rules = [
    { regExp: /\{R\}/gdi, iconType: AlteredIconType.Reserve },
    { regExp: /\{H\}/gdi, iconType: AlteredIconType.Hand },
    { regExp: /\{J\}/gdi, iconType: AlteredIconType.ETB },
    { regExp: /\{D\}/gd, iconType: AlteredIconType.Support },
    { regExp: /\{X\}/gd, iconType: AlteredIconType.X },
    { regExp: /\{O\}/gd, iconType: AlteredIconType.Ocean },
    { regExp: /\{M\}/gd, iconType: AlteredIconType.Mountain },
    { regExp: /\{V\}/gd, iconType: AlteredIconType.Forest },
    { regExp: /\{T\}/gd, iconType: AlteredIconType.Exhaust },
    {
      regExp: /\{I\}/gd,
      substituteElement: (_, key) => {
        return <AlteredIcon key={key} icon={AlteredIconType.Infinite} className="text-[75%]" />
      }
    },
    {
      regExp: /\{(\d)\}/gd,
      substituteElement: (matches, key) => {
        const cost = parseInt(matches[1], 10)
        return <i key={key} className={`altered-icon-basic mana-${cost} text-[85%]`}></i>
      }
    },
    { regExp: /\[\]/gd, substituteText: (_) => ["", ""] },
    {
      // Matches both e.g. [Seasoned], [Gigantic]... and [[Anchored]], [[Fleeting]]...
      // A single [ is bolded, a double [[ is also underlined
      regExp: /(\[+)([^\[\]]+?)(\]+)/gd,
      substituteText: (matches) =>
        [(matches[1].length == 1 ? keywordClasses : underlinedKeywordClasses), matches[2]]
    },
    // { regExp: /4\+/gd, subsituteText: "FOUR+" },
  ]

  let replacements: {
    startIndex: number
    endIndex: number
    element: (key: number) => JSX.Element
  }[] = []

  for (const repl of rules) {
    const matches = text.matchAll(repl.regExp)
    for (const match of matches) {
      let elementFn: (key: number) => JSX.Element
      if (repl.iconType) {
        elementFn = (key) => <AlteredIcon key={key} icon={repl.iconType} className="inline-block px-0.5" />
      } else if (repl.substituteText != null) {
        const [classes, text] = repl.substituteText(match)
        elementFn = (key) => <span key={key} className={classes}>{text}</span>
      } else if (repl.substituteElement != null) {
        elementFn = (key) => repl.substituteElement(match, key)
      } else {
        throw new Error(`Unknown rule: ${JSON.stringify(repl)}`)
      }
      replacements.push({
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        element: elementFn,
      })
    }
  }
  // Make sure we process the matches in order of appearance
  // so that the `lastIndex` progresses monotonically
  replacements.sort((a, b) => a.startIndex - b.startIndex)

  let elements: JSX.Element[] = []
  let lastIndex = 0
  let k = 0
  for (let i = 0; i < replacements.length; i++) {
    let r = replacements[i]
    elements.push(<span key={k++}>{text.slice(lastIndex, r.startIndex)}</span>)
    elements.push(r.element(k++))
    lastIndex = r.endIndex
  }
  if (lastIndex < text.length) {
    elements.push(<span key={k++}>{text.slice(lastIndex)}</span>)
  }

  return <>{elements}</>
}

const AbilityLink: FC<{ part: DisplayPartOnCard, children: string, ability: DisplayAbilityOnCard }> = ({ part, children, ability }) => {

  let linkText = children
  let addedText: string | undefined = undefined
  let title: string | undefined = undefined
  let classes: string = ""

  const showNullNoConditionSymbol = (ability: DisplayAbilityOnCard) => {
    if (ability.isSupport) {
      return false
    }
    if (ability.parts.find((p) => p.partType == AbilityPartType.Trigger && p.substituteText != null)) {
      return false
    }
    return true
  }

  if (children == "[]") {
    if (part.substituteText == "$noCondition" && showNullNoConditionSymbol(ability)) {
      // We should a null-set symbol for no-condition, to make it easy to search for
      // other abilities that don't have a condition
      classes = "font-light"
      linkText = "∅"
      addedText = "\u00A0"
      title = "No condition"
    } else {
      // If we get a "[]" part that isn't a $noCondition, we don't want to show it
      // This may change in the future to handle other parts, maybe static?
      return null
    }
  }

  let textWithSymbols = findReplaceSymbols(linkText)

  switch (part.partType) {
    case AbilityPartType.Trigger:
      classes = "hover:text-palette-carrot"
      break
    case AbilityPartType.Condition:
      classes = "hover:text-palette-teal"
      break
    case AbilityPartType.Effect:
    case AbilityPartType.ExtraEffect:
      classes = "hover:text-palette-fern"
      break
    default:
      classes = ""
  }

  classes += " font-medium hover:underline hover:underline-offset-1 cursor-pointer"

  const [searchParams] = useSearchParams();
  const onClickHandler = useCallback(() => {
    switch (part.partType) {
      case AbilityPartType.Trigger:
        searchParams.set("tr", `"${children}"`)
        break
      case AbilityPartType.Condition:
        searchParams.set("cond", `"${children}"`)
        break
      case AbilityPartType.Effect:
      case AbilityPartType.ExtraEffect:
        searchParams.set("eff", `"${children}"`)
        break
    }
    const newSearch = searchParams.toString();
    window.location.search = newSearch;
  }, [part.partId, part.partType, searchParams])

  if (addedText) {
    return <><a onClick={onClickHandler} className={classes} title={title}>{textWithSymbols}</a>{addedText}</>
  } else {
    return <a onClick={onClickHandler} className={classes} title={title}>{textWithSymbols}</a>
  }
}


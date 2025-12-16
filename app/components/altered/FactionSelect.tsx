import { SelectProps } from "@radix-ui/react-select"
import { FC } from "react"
import { useTranslation } from "~/lib/i18n";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { CardSet, Faction } from "~/models/cards"

interface FactionSelectProps extends SelectProps {
  value: string
  onValueChange?: (value: string | undefined) => void
}

export const FactionSelect: FC<FactionSelectProps> = ({ value, onValueChange, ...props }) => {
  const { t } = useTranslation();

  const labelMap = { 
    "any": t('faction_any'),
    [Faction.Axiom]: "Axiom",
    [Faction.Bravos]: "Bravos",
    [Faction.Lyra]: "Lyra",
    [Faction.Muna]: "Muna",
    [Faction.Ordis]: "Ordis",
    [Faction.Yzmir]: "Yzmir",
  }
  return (
    <Select value={value} onValueChange={onValueChange} {...props}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={"any"}>
            <label className="text-muted-foreground">{labelMap["any"]}</label>
          </SelectItem>
          {Object.values(Faction).map((faction) => (
            <SelectItem key={faction} value={faction}>
              {labelMap[faction]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

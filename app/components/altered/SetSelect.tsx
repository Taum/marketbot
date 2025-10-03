import { SelectProps } from "@radix-ui/react-select"
import { FC } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { CardSet, Faction } from "~/models/cards"

interface SetSelectProps extends SelectProps {
  value: string
  onValueChange?: (value: string | undefined) => void
}

export const SetSelect: FC<SetSelectProps> = ({ value, onValueChange, ...props }) => {
  const labelMap = {
    "any": "Any set",
    [CardSet.Core]: "Core",
    [CardSet.Alize]: "Trial by Frost",
    [CardSet.Bise]: "Whispers from the Maze",
    [CardSet.Cyclone]: "Skybound Odyssey",
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
          {Object.values(CardSet).map((faction) => (
            <SelectItem key={faction} value={faction}>
              {labelMap[faction]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

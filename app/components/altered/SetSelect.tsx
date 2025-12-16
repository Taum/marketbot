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
import { MultiSelect } from "~/components/ui-ext/multi-select"

interface SetSelectProps extends SelectProps {
  value: string | string[]
  onValueChange?: (value: string | string[] | undefined) => void
  multiple?: boolean
}

export const SetSelect: FC<SetSelectProps> = ({ value, onValueChange, multiple = false, ...props }) => {
  const labelMap = {
    "any": "Any set",
    [CardSet.Core]: "Core",
    [CardSet.Alize]: "Trial by Frost",
    [CardSet.Bise]: "Whispers from the Maze",
    [CardSet.Cyclone]: "Skybound Odyssey",
  }
  // When multiple selection is requested, use the existing MultiSelect
  if (multiple) {
    const options = Object.values(CardSet).map((set) => ({
      label: (labelMap as any)[set] ?? set,
      value: set,
    }))

    const defaultValue = Array.isArray(value)
      ? value
      : value && value !== "any"
      ? [value as string]
      : []

    return (
      <MultiSelect
        options={options}
        defaultValue={defaultValue}
        onValueChange={(vals) => onValueChange?.(vals)}
        placeholder="Select sets"
        {...(props as any)}
      />
    )
  }

  return (
    <Select value={String(value ?? "")} onValueChange={onValueChange as any} {...props}>
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

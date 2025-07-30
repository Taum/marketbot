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

interface SaveSelectProps extends SelectProps {
  value: string
  options: string[]
  onValueChange?: (value: string | undefined) => void
}

export const SaveSelect: FC<SaveSelectProps> = ({ value, options, onValueChange, ...props }) => {
  const labelMap = {
    "none": "None",
  }
  return (
    <Select value={value} onValueChange={onValueChange} {...props}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={"none"}>
            <label className="text-muted-foreground">{labelMap["none"]}</label>
          </SelectItem>
          {options.map((save) => (
            <SelectItem key={save} value={save}>
              {save}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

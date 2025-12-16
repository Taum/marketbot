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
import { CardSet, Faction, titleForCardSet } from "~/models/cards"
import { MultiSelect } from "~/components/ui-ext/multi-select"
import { useLoaderData } from "@remix-run/react";

interface SetSelectProps extends SelectProps {
  value: string
  onValueChange?: (value: string | undefined) => void
}

export const SetSelect: FC<SetSelectProps> = ({ value, onValueChange, multiple = false, ...props }) => {
  const { t } = useTranslation();
  const data = useLoaderData<{ locale?: string }>();
  const lang = data?.locale ?? "en";
  const labelMap = {
    "any": t("set_any"),
    [CardSet.Core]: titleForCardSet(CardSet.Core, lang),
    [CardSet.Alize]: titleForCardSet(CardSet.Alize, lang),
    [CardSet.Bise]: titleForCardSet(CardSet.Bise, lang),
    [CardSet.Cyclone]: titleForCardSet(CardSet.Cyclone, lang),
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
        placeholder={t('select_sets')}
        {...(props as any)}
      />
    )
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

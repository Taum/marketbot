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
import { CardSet, titleForCardSet } from "~/models/cards"
import { MultiSelect } from "~/components/ui-ext/multi-select"
import { useLoaderData } from "@remix-run/react";

interface SetSelectSingleProps extends Omit<SelectProps, 'value' | 'onValueChange'> {
  multiple?: false;
  value: string;
  onValueChange?: (value: string | undefined) => void;
}

interface SetSelectMultiProps extends Omit<SelectProps, 'value' | 'onValueChange'> {
  multiple: true;
  value: string[];
  onValueChange?: (value: string[]) => void;
}

type SetSelectProps = SetSelectSingleProps | SetSelectMultiProps;

export const SetSelect: FC<SetSelectProps> = (props) => {
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
  if (props.multiple) {
    const options = Object.values(CardSet).map((set) => ({
      label: labelMap[set as keyof typeof labelMap] ?? set,
      value: set,
    }))

    return (
      <MultiSelect
        options={options}
        defaultValue={props.value}
        onValueChange={(vals) => props.onValueChange?.(vals)}
        placeholder={t('select_sets')}
      />
    )
  }

  const { value, onValueChange, ...restProps } = props;
  return (
    <Select value={value} onValueChange={onValueChange} {...restProps}>
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

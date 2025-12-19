import { useLoaderData } from "@remix-run/react";
import { Link } from "@remix-run/react";
import { useTranslation } from "~/lib/i18n";
import prisma from "@common/utils/prisma.server";
import { cn, groupBy, nullifyTrim } from "~/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { findReplaceSymbols } from "~/components/altered/ResultGrid";
import { LoaderFunctionArgs } from "@remix-run/node";
import { detectLocaleFromAcceptLanguage } from "~/lib/i18n.server";

interface DisplayAbilityPart {
  id: number;
  text: string;
  partType: string;
  count: number;
  isSupport: boolean;
}

type LoaderData = {
  abilityParts: {
    trigger: DisplayAbilityPart[];
    condition: DisplayAbilityPart[];
    effect: DisplayAbilityPart[];
  }
};

export async function loader({ request }: LoaderFunctionArgs) {
  // change ordering according to locale
  const url = new URL(request.url);
  const langParam = nullifyTrim(url.searchParams.get("lang"));
  const lang = langParam ?? "en";
  let orderBys: any;
  if (lang === "fr") {
    orderBys = [
      { isSupport: "asc" },
      { textFr: "asc" }
    ]
  } else {
    orderBys = [
      { isSupport: "asc" },
      { textEn: "asc" }
    ]
  } 
  // TODO: include count of UniqueAbilityLine that include this part
  const abilities = await prisma.uniqueAbilityPart.findMany({
    orderBy: orderBys,
    include: {
      _count: {
        select: {
          allAbilities: true,
        }
      },
    },
  });

  const exportAbilities: DisplayAbilityPart[] = abilities.map((a) => {
    return {
      id: a.id,
      text: lang === "fr" ? a.textFr : a.textEn,
      partType: a.partType.toString(),
      count: a._count.allAbilities,
      isSupport: a.isSupport,
    }
  });
  const groups = groupBy(exportAbilities, (a) => a.partType)
  const abilityParts = {
    trigger: groups.Trigger,
    condition: groups.Condition,
    effect: groups.Effect,
  }

  return { abilityParts };
}

export default function AbilitiesList() {
  const { abilityParts } = useLoaderData<LoaderData>();
  const { t } = useTranslation();

  return (
    <div className="global-page">
      <h1 className="text-2xl font-bold mb-6">{t('abilities_list_title')}</h1>

      <div className="grid gap-8">
        <AbilityPartSection title={t('ability_section_trigger')} abilityParts={abilityParts.trigger} />
        <AbilityPartSection title={t('ability_section_condition')} abilityParts={abilityParts.condition} />
        <AbilityPartSection title={t('ability_section_effect')} abilityParts={abilityParts.effect} />
      </div>
    </div>
  );
}


function replaceSymbolsForTables(text: string): JSX.Element {
  if (text == "[]") {
    return <span className="">[]</span>
  }
  return findReplaceSymbols(text)
}

function AbilityPartSection({ title, abilityParts }: { title: string; abilityParts: DisplayAbilityPart[] }) {
  const { t } = useTranslation();
  if (!abilityParts || abilityParts.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table_id')}</TableHead>
            <TableHead>{t('table_name')}</TableHead>
            <TableHead></TableHead>
            <TableHead>{t('table_count')}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {abilityParts.map((part) => (
            <TableRow className="font-medium" key={part.id}>
              <TableCell className="text-muted-foreground">{part.id}</TableCell>
              <TableCell className={cn(part.count == 0 && "line-through text-red-200")}>
                <div title={part.text}>
                  {replaceSymbolsForTables(part.text)}
                </div>
              </TableCell>
              <TableCell>{part.isSupport ? t('support') : t('main')}</TableCell>
              <TableCell className="text-right pr-12 w-1">{part.count}</TableCell>
              <TableCell>
                <Link
                  to={`/by-ability/${part.id}`}
                  className="text-primary hover:underline"
                >
                  {t('view_cards')}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

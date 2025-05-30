import { useLoaderData } from "@remix-run/react";
import { Link } from "@remix-run/react";
import prisma from "@common/utils/prisma.server";
import { cn, groupBy } from "~/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";


interface DisplayAbilityPart {
  id: number;
  name: string;
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

export async function loader() {
  // TODO: include count of UniqueAbilityLine that include this part
  const abilities = await prisma.uniqueAbilityPart.findMany({
    orderBy: [
      { isSupport: "asc" },
      { textEn: "asc" },
    ],
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
      name: a.textEn,
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

  return (
    <div className="global-page">
      <h1 className="text-2xl font-bold mb-6">Unique Ability Parts List</h1>

      <div className="grid gap-8">
        <AbilityPartSection title="Trigger" abilityParts={abilityParts.trigger} />
        <AbilityPartSection title="Condition" abilityParts={abilityParts.condition} />
        <AbilityPartSection title="Effect" abilityParts={abilityParts.effect} />
      </div>
    </div>
  );
}

function AbilityPartSection({ title, abilityParts }: { title: string; abilityParts: DisplayAbilityPart[] }) {
  if (!abilityParts || abilityParts.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead></TableHead>
            <TableHead>Count</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {abilityParts.map((part) => (
            <TableRow className="font-medium" key={part.id}>
              <TableCell className="text-muted-foreground">{part.id}</TableCell>
              <TableCell className={cn(part.count == 0 && "line-through text-red-200")}>{part.name}</TableCell>
              <TableCell>{part.isSupport ? "Support" : "Main"}</TableCell>
              <TableCell className="text-right pr-12 w-1">{part.count}</TableCell>
              <TableCell>
                <Link
                  to={`/by-ability/${part.id}`}
                  className="text-primary hover:underline"
                >
                  {"View\u00A0cards"}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

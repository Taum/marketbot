import { useLoaderData } from "@remix-run/react";
import { Link } from "@remix-run/react";
import prisma from "@common/utils/prisma.server";
import { groupBy } from "~/lib/utils";
import { MainUniqueAbility, MainUniqueAbilityPart } from "@prisma/client";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";


interface DisplayAbilityPart {
  id: number;
  name: string;
  partType: string;
}

type LoaderData = {
  abilityParts: {
    trigger: DisplayAbilityPart[];
    triggerCondition: DisplayAbilityPart[];
    condition: DisplayAbilityPart[];
    effect: DisplayAbilityPart[];
  }
};

export async function loader() {
  // TODO: include count of MainUniqueAbility that include this part
  const abilities = await prisma.mainUniqueAbilityPart.findMany({
  });
  
  const exportAbilities: DisplayAbilityPart[] = abilities.map((a) => ({
    id: a.id,
    name: a.textEn,
    partType: a.partType.toString(),
  }));
  const groups = groupBy(exportAbilities, (a) => a.partType);
  const abilityParts = {
    trigger: groups.Trigger,
    triggerCondition: groups.TriggerCondition,
    condition: groups.Condition,
    effect: groups.Effect,
  }

  return { abilityParts };
}

export default function AbilitiesList() {
  const { abilityParts } = useLoaderData<LoaderData>();
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Unique Ability Parts List</h1>
      
      <div className="grid gap-8">
        <AbilityPartSection title="Trigger" abilityParts={abilityParts.trigger} />
        <AbilityPartSection title="Trigger Condition" abilityParts={abilityParts.triggerCondition} />
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
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {abilityParts.map((part) => (
            <TableRow key={part.id}>
              <TableCell className="font-medium">{part.id}</TableCell>
              <TableCell>{part.name}</TableCell>
              <TableCell>
                <Link 
                  to={`/by-ability/${part.id}`} 
                  className="text-primary hover:underline"
                >
                  View cards
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

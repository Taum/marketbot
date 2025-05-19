import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { MainUniqueAbility, MainUniqueAbilityPart, UniqueInfo } from "@prisma/client";
import prisma from "@common/utils/prisma.server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { DisplayUniqueCard, Faction } from "~/models/cards";
import { ResultGrid } from "~/components/altered/ResultGrid";

interface DisplayAbility {
  id: number
  textEn: string
  parts: {
    trigger: { id: number, textEn: string } | null
    triggerCondition: { id: number, textEn: string } | null
    condition: { id: number, textEn: string } | null
    effect: { id: number, textEn: string } | null
  }
}

type LoaderData = {
  part: MainUniqueAbilityPart | null;
  abilities: MainUniqueAbility[]
  results: DisplayUniqueCard[]
};

export async function loader({ params }: LoaderFunctionArgs) {
  const partId = parseInt(params.partId || "", 10);

  if (isNaN(partId)) {
    throw new Response("Invalid part ID", { status: 400 });
  }

  // Find the ability part
  const part = await prisma.mainUniqueAbilityPart.findUnique({
    where: { id: partId },
  });

  if (!part) {
    throw new Response("Part not found", { status: 404 });
  }

  // Find all unique cards that have this ability part in any of the part types
  const dbAbilities = await prisma.mainUniqueAbility.findMany({
    where: {
      OR: [
        { triggerId: partId },
        { triggerConditionId: partId },
        { conditionId: partId },
        { effectId: partId },
      ],
    },
    include: {
      trigger: true,
      triggerCondition: true,
      condition: true,
      effect: true,
      uniqueInfo: {
        select: {
          id: true,
          ref: true,
          nameEn: true,
          faction: true,
          cardSet: true,
          mainEffectEn: true,
          echoEffectEn: true,
          imageUrlEn: true,
          lastSeenInSaleAt: true,
          lastSeenInSalePrice: true,
        },
      },
    },
  });

  // const abilities: DisplayAbility[] = dbAbilities.map((ability) => {
  //   return {
  //     id: ability.id,
  //     textEn: ability.textEn,
  //     parts: {
  //       trigger: ability.trigger,
  //       triggerCondition: ability.triggerCondition,
  //       condition: ability.condition,
  //       effect: ability.effect,
  //     }
  //   }
  // });

  const results: DisplayUniqueCard[] = dbAbilities.map((ability) => {
    if (!ability.uniqueInfo.ref || !ability.uniqueInfo.nameEn || !ability.uniqueInfo.faction) {
      return null;
    }
    return {
      ref: ability.uniqueInfo.ref,
      name: ability.uniqueInfo.nameEn,
      faction: ability.uniqueInfo.faction as Faction,
      cardSet: ability.uniqueInfo.cardSet ?? "",
      mainEffect: ability.uniqueInfo.mainEffectEn ?? "",
      echoEffect: ability.uniqueInfo.echoEffectEn ?? "",
      imageUrl: ability.uniqueInfo.imageUrlEn ?? "",
      lastSeenInSaleAt: ability.uniqueInfo.lastSeenInSaleAt?.toISOString(),
      lastSeenInSalePrice: ability.uniqueInfo.lastSeenInSalePrice?.toString(),
    };
  }).filter((unique) => unique !== null);

  return { part, results };
}

export default function ByAbilityPartRoute() {
  const { part, results, abilities } = useLoaderData<LoaderData>();

  if (!part) {
    return <div className="container mx-auto p-6">Ability part not found</div>;
  }

  const now = new Date()

  return (
    <div className="container mx-auto p-6">
      <div className="mt-6 mb-2">
        <Link to="/abilities-list" className="text-primary hover:underline">
          ← Back to abilities list
        </Link>
      </div>
      <div className="bg-muted px-4 py-2 rounded-lg mb-6">
        <span className="text text-muted-foreground">Ability ({part.partType}):</span>
        <h1 className="text-xl font-bold mb-2">{part.textEn}</h1>
        <div className="text-sm text-muted-foreground">
          <p>Found in {results.length} cards</p>
        </div>
      </div>

      {results.length > 0 ? (
        <ResultGrid results={results} now={now} />
      ) : (
        <div className="text-center py-6">
          <p>No unique cards found with this ability part.</p>
        </div>
      )}

    </div>
  );
}

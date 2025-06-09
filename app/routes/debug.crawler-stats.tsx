import prisma from "@common/utils/prisma.server";
import { useLoaderData } from "@remix-run/react";
import { formatDuration, intervalToDuration } from "date-fns";
import { AlteredIcon, AlteredIconType } from "~/components/altered/AlteredIcon";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";

export async function loader() {
  const dbLastUpdates = await prisma.marketUpdateStats.findMany({
    select: {
      generationId: true,
      updateStartedAt: true,
      updateCompletedAt: true,
      newCardsAdded: true,
      totalOffersUpdated: true,
    },
    orderBy: {
      generationId: "desc",
    },
    take: 10,
  });

  const familyStats = await prisma.cardFamilyStats.findMany({
    select: {
      id: true,
      cardFamilyId: true,
      name: true,
      faction: true,
      totalItems: true,
      fetchStartedAt: true,
      fetchCompletedAt: true,
      fetchStartGeneration: true,
      fetchCompletedGeneration: true,
    },
    orderBy: [
      { cardFamilyId: "asc" },
      { faction: "asc" },
    ],
  });

  const uniquesCount = await prisma.uniqueInfo.groupBy({
    by: ["fetchedDetails"],
    _count: true,
  });
  const activeUniques = await prisma.uniqueInfo.count({
    where: {
      seenInLastGeneration: true,
    }
  });

  const totalFamiliesCount = familyStats.length;

  const lastUpdates = dbLastUpdates.map((update) => ({
    generationId: update.generationId,
    updateStartedAt: update.updateStartedAt,
    updateCompletedAt: update.updateCompletedAt,
    familiesCompleted: familyStats.filter((fam) => fam.fetchCompletedGeneration === update.generationId).length,
    newCardsAdded: update.newCardsAdded,
    totalOffersUpdated: update.totalOffersUpdated,
  }));

  const uniquesTotal = uniquesCount.reduce((acc, curr) => acc + curr._count, 0);
  const uniquesMissingEffectText = uniquesCount.find((r) => r.fetchedDetails === false)?._count ?? 0;

  return {
    lastUpdates,
    familyStats,
    totalFamiliesCount,
    uniques: {
      total: uniquesTotal,
      missingEffect: uniquesMissingEffectText,
      active: activeUniques,
    }
  }
}

export default function CrawlerStats() {
  const { lastUpdates, familyStats, uniques, totalFamiliesCount } = useLoaderData<typeof loader>();

  const familiesOver1000 = familyStats.filter((fam) => fam.totalItems && fam.totalItems >= 900);

  return <div className="global-page">
    <h1>Crawler Stats</h1>
    <h2>Unique Info</h2>
    <div className="mb-8">
      <Table>
        <TableBody>
          <TableRow>
            <TableHead className="w-48">Total</TableHead>
            <TableCell className="font-mono">{uniques.total}</TableCell>
          </TableRow>
          <TableRow>
            <TableHead className="">With active offers</TableHead>
            <TableCell className="font-mono">{uniques.active}</TableCell>
          </TableRow>
          <TableRow>
            <TableHead className="">Expired</TableHead>
            <TableCell className="font-mono">{uniques.total - uniques.active}</TableCell>
          </TableRow>
          <TableRow>
            <TableHead className="">Missing effect text</TableHead>
            <TableCell className="font-mono">{uniques.missingEffect}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <h2>Last Updates</h2>
    <div className="mb-8">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Generation ID</TableHead>
            <TableHead>Started At</TableHead>
            <TableHead>Completed At</TableHead>
            <TableHead>Families Comp.</TableHead>
            <TableHead>New Cards Added</TableHead>
            <TableHead>Total Offers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lastUpdates.map((update) => (
            <TableRow key={update.generationId} className="font-mono">
              <TableCell>{update.generationId}</TableCell>
              <TableCell>{update.updateStartedAt.toLocaleString()}</TableCell>
              <TableCell>{update.updateCompletedAt?.toLocaleString()}</TableCell>
              <TableCell>
                {update.familiesCompleted > 0 ?
                  <span className="">{update.familiesCompleted} / {totalFamiliesCount}</span>
                  :
                  ""
                }
              </TableCell>
              <TableCell>{update.newCardsAdded}</TableCell>
              <TableCell>{update.totalOffersUpdated}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <h2>Family Stats</h2>
    <div>
      <Button onClick={() => {
        const json = JSON.stringify(familyStats, null, 2)
        navigator.clipboard.writeText(json)
          .then(() => {
            // Optional: Add some user feedback
            alert('JSON copied to clipboard');
          })
          .catch((err) => {
            console.error('Failed to copy:', err);
          });
      }}>
        Copy JSON
      </Button>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Total Items</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Faction</TableHead>
            <TableHead>Update Duration</TableHead>
            <TableHead>Start Gen</TableHead>
            <TableHead>Completed Gen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {familiesOver1000.map((fam) => {
            const duration = fam.fetchStartedAt && fam.fetchCompletedAt ? intervalToDuration({
              start: fam.fetchStartedAt,
              end: fam.fetchCompletedAt,
            }) : undefined
            const durationStr = duration ? formatDuration(duration) : "N/A"
            return (
              <TableRow key={fam.id} className="bg-red-500">
                <TableCell className={cn("font-semibold text-base")}>
                  {fam.totalItems?.toString().padStart(5, "\u00a0")}
                </TableCell>
                <TableCell>{fam.name}</TableCell>
                <TableCell>{fam.cardFamilyId}</TableCell>
                <TableCell className={`text-${fam.faction.toLocaleLowerCase()}-500`}>{fam.faction}</TableCell>
                <TableCell>
                  <span title={`${fam.fetchStartedAt?.toLocaleString()} -> ${fam.fetchCompletedAt?.toLocaleString()}`}>
                    {durationStr ?? fam.fetchCompletedAt?.toLocaleString() ?? "??"}
                  </span>
                </TableCell>
                <TableCell>{fam.fetchStartGeneration}</TableCell>
                <TableCell>{fam.fetchCompletedGeneration}</TableCell>
              </TableRow>
            )
          })}
          {familyStats.map((fam) => {
            const duration = fam.fetchStartedAt && fam.fetchCompletedAt ? intervalToDuration({
              start: fam.fetchStartedAt,
              end: fam.fetchCompletedAt,
            }) : undefined
            const durationStr = duration ? formatDuration(duration) : "N/A"
            return (
              <TableRow key={fam.id} className="font-mono">
                <TableCell className={cn("font-semibold text-base", fam.totalItems && fam.totalItems >= 1000 && "text-red-600")}>
                  {fam.totalItems?.toString().padStart(5, "\u00a0")}
                </TableCell>
                <TableCell>{fam.name}</TableCell>
                <TableCell>{fam.cardFamilyId}</TableCell>
                <TableCell className={`text-faction-${fam.faction.toLowerCase()} text-lg`}><AlteredIcon icon={fam.faction.toLowerCase() as AlteredIconType} /></TableCell>
                <TableCell>
                  <span title={`${fam.fetchStartedAt?.toLocaleString()} -> ${fam.fetchCompletedAt?.toLocaleString()}`}>
                    {durationStr == "" ? "0" : durationStr}
                  </span>
                </TableCell>
                <TableCell>{fam.fetchStartGeneration}</TableCell>
                <TableCell>{fam.fetchCompletedGeneration}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  </div>;
}

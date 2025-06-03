import prisma from "@common/utils/prisma.server";
import { useLoaderData } from "@remix-run/react";
import { formatDuration, intervalToDuration } from "date-fns";
import { AlteredIcon, AlteredIconType } from "~/components/altered/AlteredIcon";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { cn } from "~/lib/utils";

export async function loader() {
  const lastUpdates = await prisma.marketUpdateStats.findMany({
    orderBy: {
      generationId: "desc",
    },
    take: 10,
  });

  const familyStats = await prisma.cardFamilyStats.findMany({
    orderBy: [
      { cardFamilyId: "asc" },
      { faction: "asc" },
    ],
  });

  return { lastUpdates, familyStats };
}

export default function CrawlerStats() {
  const { lastUpdates, familyStats } = useLoaderData<typeof loader>();

  const familiesOver1000 = familyStats.filter((fam) => fam.totalItems && fam.totalItems >= 900);

  return <div className="global-page">
    <h1>Crawler Stats</h1>
    <h2>Last Updates</h2>
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Generation ID</TableHead>
            <TableHead>Started At</TableHead>
            <TableHead>Completed At</TableHead>
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
                    {durationStr}
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
                    {durationStr}
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

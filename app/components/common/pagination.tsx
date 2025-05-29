import { range } from "radash";
import { FC, useMemo } from "react";
import { buttonVariants } from "~/components/ui/button";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";
import { cn } from "~/lib/utils";

interface ResultsPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const ResultsPagination: FC<ResultsPaginationProps> = ({ currentPage, totalPages, onPageChange }: ResultsPaginationProps) => {
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const pageItems = useMemo(() => {
    let pagesToShow: number[] = (totalPages <= 7) ?
      Array.from(range(1, totalPages)) :
      [1, ...Array.from(range(Math.max(2, currentPage - 2), Math.min(totalPages - 1, currentPage + 2))), totalPages];

    let pageItems: React.ReactNode[] = [];
    for (let i = 0; i < pagesToShow.length; i++) {
      let pageNumber = pagesToShow[i];
      if (i > 0 && pagesToShow[i - 1] != pageNumber - 1) {
        pageItems.push(<PaginationEllipsis key={`ellipsis-${i}`} />);
      }
      const isDisabled = pageNumber === currentPage;
      pageItems.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => onPageChange(pageNumber)}
            isActive={pageNumber === currentPage}
            className={isDisabled ? "pointer-events-none" : "cursor-pointer"}
            aria-disabled={isDisabled}
            >
            {pageNumber}
          </PaginationLink>
        </PaginationItem>
      )
    }
    return pageItems;
  }, [totalPages, currentPage])

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            className={!hasPrevious ? "pointer-events-none text-muted-foreground" : "cursor-pointer"}
            aria-disabled={!hasPrevious}
          />
        </PaginationItem>
        {pageItems}
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            aria-disabled={!hasNext}
            className={!hasNext ? "pointer-events-none text-muted-foreground" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
} 
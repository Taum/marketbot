import { range } from "radash";
import { FC, useMemo } from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";

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
    const pagesToShow: number[] = (totalPages <= 7) ?
      Array.from(range(1, totalPages)) :
      [1, ...Array.from(range(Math.max(2, currentPage - 2), Math.min(totalPages - 1, currentPage + 2))), totalPages];

    const pageItems: React.ReactNode[] = [];
    for (let i = 0; i < pagesToShow.length; i++) {
      const pageNumber = pagesToShow[i];
      if (i > 0 && pagesToShow[i - 1] != pageNumber - 1) {
        pageItems.push(
          <PaginationEllipsis key={`ellipsis-${i}`} className="hidden sm:flex" />
        );
      }
      const isDisabled = pageNumber === currentPage;
      // On mobile, only show current page, first and last
      const hideOnMobile = pageNumber !== 1 && pageNumber !== totalPages && pageNumber !== currentPage;
      pageItems.push(
        <PaginationItem key={i} className={hideOnMobile ? "hidden sm:block" : ""}>
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
  }, [totalPages, currentPage, onPageChange])

  return (
    <Pagination>
      <PaginationContent className="gap-0.5 sm:gap-1">
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
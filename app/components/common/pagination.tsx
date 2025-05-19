import { FC } from "react";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "~/components/ui/pagination";

interface ResultsPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const disabledButton = "text-muted-foreground/50 pointer-events-none"

export const ResultsPagination: FC<ResultsPaginationProps> = ({ currentPage, totalPages, onPageChange }: ResultsPaginationProps) => {
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            className={!hasPrevious ? disabledButton : ""}
            aria-disabled={!hasPrevious}
          />
        </PaginationItem>
        {Array.from({ length: totalPages }, (_, i) => (
          <PaginationItem key={i}>
            <PaginationLink onClick={() => onPageChange(i + 1)} isActive={i + 1 === currentPage}>
              {i + 1}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            aria-disabled={!hasNext}
            className={!hasNext ? disabledButton : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
} 
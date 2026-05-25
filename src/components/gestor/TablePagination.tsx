import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface TablePaginationProps {
  total: number;
  pageSize: number;
  currentPage: number;
  onPageSizeChange: (n: number) => void;
  onPageChange: (p: number) => void;
  pageSizeOptions?: number[];
}

export default function TablePagination({
  total,
  pageSize,
  currentPage,
  onPageSizeChange,
  onPageChange,
  pageSizeOptions = [10, 25, 50, 100, 0],
}: TablePaginationProps) {
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span>Linhas por página:</span>
        <Select
          value={String(pageSize)}
          onValueChange={v => { onPageSizeChange(Number(v)); onPageChange(1); }}
        >
          <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map(n => (
              <SelectItem key={n} value={String(n)} className="text-xs">
                {n === 0 ? "Todos" : n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {pageSize > 0 && totalPages > 1 && (
        <div className="flex items-center gap-1">
          <span className="mr-1">
            {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} de {total}
          </span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" disabled={currentPage === 1} onClick={() => onPageChange(1)}>«</Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>‹</Button>
          <span className="px-2">{currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>›</Button>
          <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-xs" disabled={currentPage === totalPages} onClick={() => onPageChange(totalPages)}>»</Button>
        </div>
      )}
    </div>
  );
}

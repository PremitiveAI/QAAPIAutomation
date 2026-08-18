"use client";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  totalItems: number;
  setCurrentPage: (page: number) => void;
  setRowsPerPage: (rows: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  rowsPerPage,
  totalItems,
  setCurrentPage,
  setRowsPerPage,
}: PaginationProps) {
  const startItem = (currentPage - 1) * rowsPerPage + 1;
  const endItem = Math.min(currentPage * rowsPerPage, totalItems);

  const getPages = () => {
    const pages: (number | "...")[] = [];

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    pages.push(1);

    if (currentPage > 4) pages.push("...");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 3) pages.push("...");

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="w-full bg-[#0f172a] text-gray-300 px-6 py-3 rounded-md flex items-center justify-between text-sm">

      {/* LEFT SECTION */}
      <div className="flex items-center gap-6">

        {/* Showing text */}
        <div>
          Showing{" "}
          <span className="text-white font-medium">
            {startItem} to {endItem}
          </span>{" "}
          of{" "}
          <span className="text-white font-medium">
            {totalItems}
          </span>{" "}
          results
        </div>

        {/* Items per page */}
        <div className="flex items-center gap-2">
          <span>Items per page:</span>
         <select
  value={rowsPerPage}
  onChange={(e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  }}
  className="bg-gray-800 border border-gray-700 text-white 
           rounded-md px-3 py-1.5 text-sm 
           focus:outline-none focus:ring-1 focus:ring-purple-500 
           transition-all duration-200
           cursor-pointer"
>
  <option value={5}>5</option>
  <option value={10}>10</option>
  <option value={15}>15</option>
  <option value={25}>25</option>
  <option value={50}>50</option>
</select>
        </div>
      </div>

      {/* RIGHT SECTION - Pagination Controls */}
      <div className="flex items-center gap-2">

        {/* First Page */}
        <button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 disabled:opacity-40"
        >
          «
        </button>

        {/* Previous */}
        <button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2 py-1 disabled:opacity-40"
        >
          ‹
        </button>

        {/* Page Numbers */}
        {getPages().map((page, index) => {
          if (page === "...") {
            return (
              <span key={index} className="px-2">
                …
              </span>
            );
          }

          return (
            <button
              key={index}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 rounded-md transition
                ${
                  page === currentPage
                    ? "bg-gradient-to-r from-purple-800 to-purple-500 text-white shadow-md shadow-purple-900/40"
                    : "hover:bg-white/10"
                }`}
            >
              {page}
            </button>
          );
        })}

        {/* Next */}
        <button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 disabled:opacity-40"
        >
          ›
        </button>

        {/* Last */}
        <button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 disabled:opacity-40"
        >
          »
        </button>
      </div>
    </div>
  );
}

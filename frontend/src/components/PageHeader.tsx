export default function PageHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-14 z-20 bg-gray-50 dark:bg-[#0c1120] -mx-6 px-4 sm:px-6 pt-2 pb-2 border-b border-gray-100 dark:border-gray-800 mb-2">
      {children}
    </div>
  )
}

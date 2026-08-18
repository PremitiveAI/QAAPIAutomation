interface StatCardProps {
  title: string;
  value: number;
  onClick?: () => void;
}

export default function StatCard({ title, value, onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl bg-white/10 p-6 hover:bg-white/20"
    >
      <p className="text-sm opacity-70">{title}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
  );
}

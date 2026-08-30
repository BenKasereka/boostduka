import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function DonutChart({ data, centerValue, centerLabel, height = 220 }) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="72%"
            outerRadius="100%"
            paddingAngle={data.length > 1 ? 3 : 0}
            stroke="none"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-2xl font-semibold text-slate-800 tabular-nums leading-tight">{centerValue}</div>
        {centerLabel && <div className="text-[11px] text-slate-400 mt-0.5 text-center px-4">{centerLabel}</div>}
      </div>
    </div>
  );
}

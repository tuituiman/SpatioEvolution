export function Dashboard() {
  return (
    <div className="p-6 h-full overflow-auto animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'ชุดข้อมูล',   value: '—',  color: 'text-spatio-primary' },
          { label: 'แถวข้อมูล',   value: '—',  color: 'text-spatio-success' },
          { label: 'ช่วงเวลา',    value: '—',  color: 'text-spatio-warning' },
          { label: 'พื้นที่ครอบคลุม', value: '—', color: 'text-spatio-accent' },
        ].map(stat => (
          <div key={stat.label} className="spatio-card">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-spatio-muted mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="spatio-card flex items-center justify-center h-48 text-spatio-muted text-sm">
        นำเข้าข้อมูลเพื่อดูภาพรวม
      </div>
    </div>
  )
}

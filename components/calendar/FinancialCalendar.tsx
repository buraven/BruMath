type FinancialEvent = {
  id: string | number;
  date: string;
  title: string;
  amount: number;
  type: "income" | "expense";
};

type FinancialCalendarProps = {
  month: string;
  events?: FinancialEvent[];
  formatMoney: (value: number) => string;
  onSelectDay?: (date: string) => void;
};

const monthDays = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
};

const firstWeekday = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).getDay();
};

export function FinancialCalendar({ month, events = [], formatMoney, onSelectDay }: FinancialCalendarProps) {
  const days = monthDays(month);
  const offset = firstWeekday(month);
  const cells = Array.from({ length: offset + days }, (_, index) => index < offset ? null : index - offset + 1);
  const eventsByDay = events.reduce<Record<string, FinancialEvent[]>>((acc, event) => {
    (acc[event.date] ||= []).push(event);
    return acc;
  }, {});

  return (
    <section className="financial-calendar" aria-label="Calendário financeiro">
      <div className="calendar-weekdays">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <div className="calendar-day empty" key={`empty-${index}`} />;
          const date = `${month}-${String(day).padStart(2, "0")}`;
          const dayEvents = eventsByDay[date] || [];
          const total = dayEvents.reduce((sum, event) => sum + (event.type === "income" ? event.amount : -event.amount), 0);
          return (
            <button type="button" className="calendar-day" key={date} onClick={() => onSelectDay?.(date)}>
              <strong>{day}</strong>
              {dayEvents.length > 0 && <span className={total >= 0 ? "calendar-day-value positive" : "calendar-day-value negative"}>{formatMoney(total)}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Page = "dashboard" | "attendance" | "teachers" | "reports";
type Status = "present" | "late" | "absent";

type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  subject: string | null;
  is_active: boolean;
  created_at: string;
};

type Attendance = {
  id: string;
  teacher_id: string;
  attendance_date: string;
  status: Status;
  check_in: string | null;
  late_minutes: number | null;
  updated_at?: string | null;
};

const SCHOOL_NAME = "دبیرستان پسرانه وابسته به دانشگاه رازی";

function getToday() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentMonth() {
  return getToday().slice(0, 7);
}

function formatDate(date: string) {
  if (!date) return "-";

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) return date;

  return `${year}/${month}/${day}`;
}

function formatTime(time: string | null) {
  if (!time) return "-";

  return time.slice(0, 5);
}

function statusLabel(status: Status | undefined) {
  if (status === "present") return "حاضر";
  if (status === "late") return "تأخیر";
  if (status === "absent") return "غایب";
  return "ثبت نشده";
}

function statusClass(status: Status | undefined) {
  if (status === "present") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (status === "late") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (status === "absent") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-slate-50 text-slate-500 border-slate-200";
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  if (!year || !monthNumber) {
    return {
      startDate: `${getToday().slice(0, 7)}-01`,
      endDate: getToday(),
    };
  }

  const startDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;

  const nextMonth =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;

  return {
    startDate,
    endDate: nextMonth,
  };
}

function getMonthTitle(month: string) {
  if (!month) return "";

  const [year, monthNumber] = month.split("-");

  const monthNames = [
    "ژانویه",
    "فوریه",
    "مارس",
    "آوریل",
    "مه",
    "ژوئن",
    "ژوئیه",
    "اوت",
    "سپتامبر",
    "اکتبر",
    "نوامبر",
    "دسامبر",
  ];

  const index = Number(monthNumber) - 1;

  if (index < 0 || index > 11) return month;

  return `${monthNames[index]} ${year}`;
}

export default function HomePage() {
  const [page, setPage] = useState<Page>("dashboard");

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  const [selectedDate, setSelectedDate] = useState(getToday());
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const [search, setSearch] = useState("");

  const [reportLoading, setReportLoading] = useState(false);
  const [reportAttendance, setReportAttendance] = useState<Attendance[]>([]);

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();

    attendance.forEach((item) => {
      map.set(item.teacher_id, item);
    });

    return map;
  }, [attendance]);

  const activeTeachers = useMemo(() => {
    return teachers.filter((teacher) => teacher.is_active);
  }, [teachers]);

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return activeTeachers;

    return activeTeachers.filter((teacher) => {
      const fullName =
        `${teacher.first_name} ${teacher.last_name}`.toLowerCase();

      const subject = teacher.subject?.toLowerCase() ?? "";
      const phone = teacher.phone?.toLowerCase() ?? "";

      return (
        fullName.includes(query) ||
        subject.includes(query) ||
        phone.includes(query)
      );
    });
  }, [activeTeachers, search]);

  const todayStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let unrecorded = 0;
    let lateMinutes = 0;

    activeTeachers.forEach((teacher) => {
      const item = attendanceMap.get(teacher.id);

      if (!item) {
        unrecorded++;
        return;
      }

      if (item.status === "present") {
        present++;
      }

      if (item.status === "late") {
        late++;
        lateMinutes += item.late_minutes ?? 0;
      }

      if (item.status === "absent") {
        absent++;
      }
    });

    return {
      present,
      late,
      absent,
      unrecorded,
      lateMinutes,
    };
  }, [activeTeachers, attendanceMap]);

  async function loadData(date = selectedDate) {
    setLoading(true);
    setError("");

    const teachersResult = await supabase
      .from("teachers")
      .select("*")
      .order("first_name", { ascending: true });

    if (teachersResult.error) {
      setError(
        teachersResult.error.message || "دریافت اطلاعات دبیران با خطا مواجه شد.",
      );
      setLoading(false);
      return;
    }

    const loadedTeachers = (teachersResult.data ?? []) as Teacher[];

    setTeachers(loadedTeachers);

    const attendanceResult = await supabase
      .from("attendance")
      .select("*")
      .eq("attendance_date", date);

    if (attendanceResult.error) {
      setError(
        attendanceResult.error.message ||
          "دریافت اطلاعات حضور و غیاب با خطا مواجه شد.",
      );
      setAttendance([]);
      setLoading(false);
      return;
    }

    setAttendance((attendanceResult.data ?? []) as Attendance[]);
    setLoading(false);
  }

  async function saveStatus(
    teacher: Teacher,
    status: Status,
    lateMinutesInput?: number,
  ) {
    setSavingId(teacher.id);
    setError("");
    setSaved(false);

    const existing = attendanceMap.get(teacher.id);

    const now = new Date();

    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}:00`;

    let lateMinutes: number | null = null;

    if (status === "late") {
      const value =
        lateMinutesInput ??
        existing?.late_minutes ??
        10;

      lateMinutes = Math.max(0, Math.floor(value));
    }

    const checkIn =
      status === "absent"
        ? null
        : existing?.check_in ?? currentTime;

    const payload = {
      teacher_id: teacher.id,
      attendance_date: selectedDate,
      status,
      check_in: checkIn,
      late_minutes: lateMinutes,
      updated_at: new Date().toISOString(),
    };

    const { data, error: saveError } = await supabase
      .from("attendance")
      .upsert(payload, {
        onConflict: "teacher_id,attendance_date",
      })
      .select()
      .single();

    if (saveError) {
      setError(saveError.message || "ثبت حضور و غیاب انجام نشد.");
      setSavingId(null);
      return;
    }

    if (data) {
      setAttendance((current) => {
        const withoutCurrent = current.filter(
          (item) => item.teacher_id !== teacher.id,
        );

        return [...withoutCurrent, data as Attendance];
      });
    }

    setSaved(true);
    setSavingId(null);

    window.setTimeout(() => {
      setSaved(false);
    }, 2000);
  }

  async function loadMonthlyReport(month = selectedMonth) {
    setReportLoading(true);
    setError("");

    const { startDate, endDate } = getMonthRange(month);

    const { data, error: reportError } = await supabase
      .from("attendance")
      .select("*")
      .gte("attendance_date", startDate)
      .lt("attendance_date", endDate)
      .order("attendance_date", { ascending: false });

    if (reportError) {
      setError(
        reportError.message || "دریافت گزارش ماهانه با خطا مواجه شد.",
      );
      setReportAttendance([]);
      setReportLoading(false);
      return;
    }

    setReportAttendance((data ?? []) as Attendance[]);
    setReportLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    if (page === "reports") {
      loadMonthlyReport();
    }
  }, [page, selectedMonth]);

  function handleDateChange(value: string) {
    setSelectedDate(value);
    setSaved(false);
    setError("");
  }

  function handlePageChange(nextPage: Page) {
    setPage(nextPage);
    setError("");
    setSaved(false);
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-100 text-slate-900"
    >
      <div className="flex min-h-screen">
        <Sidebar
          page={page}
          onPageChange={handlePageChange}
        />

        <main className="min-w-0 flex-1">
          <Header
            page={page}
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
          />

          <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <div className="mt-0.5 shrink-0">⚠️</div>
                <div className="flex-1">{error}</div>

                <button
                  onClick={() => setError("")}
                  className="rounded-lg px-2 py-1 text-red-500 hover:bg-red-100"
                >
                  ×
                </button>
              </div>
            )}

            {saved && (
              <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                ✓ اطلاعات با موفقیت ثبت شد.
              </div>
            )}

            {page === "dashboard" && (
              <DashboardPage
                teachers={activeTeachers}
                attendanceMap={attendanceMap}
                stats={todayStats}
                selectedDate={selectedDate}
                onGoToAttendance={() => handlePageChange("attendance")}
                onGoToReports={() => handlePageChange("reports")}
              />
            )}

            {page === "attendance" && (
              <AttendancePage
                teachers={filteredTeachers}
                allTeachers={activeTeachers}
                attendanceMap={attendanceMap}
                selectedDate={selectedDate}
                loading={loading}
                savingId={savingId}
                search={search}
                onSearchChange={setSearch}
                onStatusChange={saveStatus}
              />
            )}

            {page === "teachers" && (
              <TeachersPage
                teachers={activeTeachers}
                search={search}
                onSearchChange={setSearch}
              />
            )}

            {page === "reports" && (
              <ReportsPage
                teachers={activeTeachers}
                attendance={reportAttendance}
                month={selectedMonth}
                loading={reportLoading}
                onMonthChange={setSelectedMonth}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  onPageChange,
}: {
  page: Page;
  onPageChange: (page: Page) => void;
}) {
  const items: {
    id: Page;
    label: string;
    icon: string;
  }[] = [
    {
      id: "dashboard",
      label: "داشبورد",
      icon: "⌂",
    },
    {
      id: "attendance",
      label: "حضور و غیاب",
      icon: "✓",
    },
    {
      id: "teachers",
      label: "دبیران",
      icon: "♙",
    },
    {
      id: "reports",
      label: "گزارش‌ها",
      icon: "▥",
    },
  ];

  return (
    <aside className="hidden w-64 shrink-0 border-l border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-slate-200 p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-xl text-white">
          ر
        </div>

        <h1 className="text-base font-bold leading-7 text-slate-900">
          {SCHOOL_NAME}
        </h1>

        <p className="mt-1 text-xs text-slate-500">
          سامانه مدیریت حضور و غیاب دبیران
        </p>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {items.map((item) => {
          const active = page === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-right text-sm font-medium transition ${
                active
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base">
                {item.icon}
              </span>

              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">
            وضعیت سامانه
          </p>

          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            فعال
          </div>
        </div>
      </div>
    </aside>
  );
}

function Header({
  page,
  selectedDate,
  onDateChange,
}: {
  page: Page;
  selectedDate: string;
  onDateChange: (value: string) => void;
}) {
  const titles: Record<Page, string> = {
    dashboard: "داشبورد",
    attendance: "حضور و غیاب",
    teachers: "دبیران",
    reports: "گزارش‌ها",
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">
            {SCHOOL_NAME}
          </p>

          <h2 className="mt-1 truncate text-xl font-bold text-slate-900">
            {titles[page]}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {page !== "reports" && (
            <label className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:flex">
              <span className="text-xs text-slate-500">
                تاریخ:
              </span>

              <input
                type="date"
                value={selectedDate}
                onChange={(event) =>
                  onDateChange(event.target.value)
                }
                className="bg-transparent text-sm font-medium outline-none"
              />
            </label>
          )}

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
            م
          </div>
        </div>
      </div>

      {page !== "reports" && (
        <div className="border-t border-slate-100 px-4 py-3 sm:hidden">
          <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs text-slate-500">
              تاریخ حضور و غیاب
            </span>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) =>
                onDateChange(event.target.value)
              }
              className="bg-transparent text-sm font-medium outline-none"
            />
          </label>
        </div>
      )}
    </header>
  );
}

function DashboardPage({
  teachers,
  attendanceMap,
  stats,
  selectedDate,
  onGoToAttendance,
  onGoToReports,
}: {
  teachers: Teacher[];
  attendanceMap: Map<string, Attendance>;
  stats: {
    present: number;
    late: number;
    absent: number;
    unrecorded: number;
    lateMinutes: number;
  };
  selectedDate: string;
  onGoToAttendance: () => void;
  onGoToReports: () => void;
}) {
  const completion =
    teachers.length > 0
      ? Math.round(
          ((stats.present + stats.late + stats.absent) /
            teachers.length) *
            100,
        )
      : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm text-slate-400">
              {formatDate(selectedDate)}
            </p>

            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              وضعیت حضور و غیاب امروز
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              وضعیت حضور، تأخیر و غیبت دبیران را از این بخش مدیریت
              کنید.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onGoToAttendance}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
            >
              ثبت حضور و غیاب
            </button>

            <button
              onClick={onGoToReports}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              مشاهده گزارش‌ها
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="کل دبیران"
          value={teachers.length}
          description="دبیر فعال"
          icon="♙"
        />

        <StatCard
          title="حاضر"
          value={stats.present}
          description="ثبت حضور"
          icon="✓"
          tone="green"
        />

        <StatCard
          title="تأخیر"
          value={stats.late}
          description={`${stats.lateMinutes} دقیقه مجموع`}
          icon="◷"
          tone="amber"
        />

        <StatCard
          title="غایب"
          value={stats.absent}
          description="ثبت غیبت"
          icon="×"
          tone="red"
        />

        <StatCard
          title="ثبت نشده"
          value={stats.unrecorded}
          description={`${completion}% تکمیل`}
          icon="○"
          tone="gray"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900">
                وضعیت دبیران
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                خلاصه وضعیت ثبت‌شده برای {formatDate(selectedDate)}
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {teachers.length} دبیر
            </span>
          </div>

          <div className="space-y-2">
            {teachers.slice(0, 10).map((teacher) => {
              const item = attendanceMap.get(teacher.id);

              return (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                      {teacher.first_name.charAt(0)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {teacher.first_name} {teacher.last_name}
                      </p>

                      <p className="truncate text-xs text-slate-400">
                        {teacher.subject || "بدون رشته"}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {item?.status === "late" &&
                      item.late_minutes !== null && (
                        <span className="hidden text-xs text-slate-400 sm:block">
                          {item.late_minutes} دقیقه
                        </span>
                      )}

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                        item?.status,
                      )}`}
                    >
                      {statusLabel(item?.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {teachers.length > 10 && (
            <p className="mt-4 text-center text-xs text-slate-400">
              برای مشاهده همه دبیران وارد بخش حضور و غیاب شوید.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <h3 className="font-bold text-slate-900">
            میزان تکمیل امروز
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            درصد دبیرانی که وضعیت آن‌ها ثبت شده است
          </p>

          <div className="mt-8 flex items-center justify-center">
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full border-[18px] border-slate-100">
              <div
                className="absolute inset-[-18px] rounded-full border-[18px] border-transparent"
                style={{
                  background: `conic-gradient(#0f172a ${completion}%, transparent ${completion}% 100%)`,
                  mask:
                    "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                  maskComposite: "exclude",
                  padding: "18px",
                }}
              />

              <div className="text-center">
                <p className="text-4xl font-black text-slate-900">
                  {completion}%
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  تکمیل
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-3">
            <ProgressRow
              label="حاضر"
              value={stats.present}
              total={teachers.length}
            />

            <ProgressRow
              label="تأخیر"
              value={stats.late}
              total={teachers.length}
            />

            <ProgressRow
              label="غایب"
              value={stats.absent}
              total={teachers.length}
            />

            <ProgressRow
              label="ثبت نشده"
              value={stats.unrecorded}
              total={teachers.length}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  tone = "gray",
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
  tone?: "gray" | "green" | "amber" | "red";
}) {
  const tones = {
    gray: "bg-slate-100 text-slate-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-black text-slate-900">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${tones[tone]}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        {description}
      </p>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage =
    total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">
          {label}
        </span>

        <span className="text-slate-400">
          {value} / {total}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-800 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function AttendancePage({
  teachers,
  allTeachers,
  attendanceMap,
  selectedDate,
  loading,
  savingId,
  search,
  onSearchChange,
  onStatusChange,
}: {
  teachers: Teacher[];
  allTeachers: Teacher[];
  attendanceMap: Map<string, Attendance>;
  selectedDate: string;
  loading: boolean;
  savingId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (
    teacher: Teacher,
    status: Status,
    lateMinutes?: number,
  ) => Promise<void>;
}) {
  const [lateInputs, setLateInputs] = useState<
    Record<string, string>
  >({});

  function getLateMinutes(teacherId: string) {
    const attendance = attendanceMap.get(teacherId);

    if (lateInputs[teacherId] !== undefined) {
      return lateInputs[teacherId];
    }

    if (
      attendance?.late_minutes !== null &&
      attendance?.late_minutes !== undefined
    ) {
      return String(attendance.late_minutes);
    }

    return "10";
  }

  function handleLateMinutesChange(
    teacher: Teacher,
    value: string,
  ) {
    const sanitized = value.replace(/[^\d]/g, "");

    setLateInputs((current) => ({
      ...current,
      [teacher.id]: sanitized,
    }));
  }

  function handleLateSave(teacher: Teacher) {
    const rawValue = getLateMinutes(teacher.id);
    const minutes = Number(rawValue);

    if (
      !rawValue ||
      Number.isNaN(minutes) ||
      minutes < 1
    ) {
      return;
    }

    onStatusChange(teacher, "late", minutes);
  }

  const recordedCount = allTeachers.filter((teacher) =>
    attendanceMap.has(teacher.id),
  ).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              ثبت حضور و غیاب دبیران
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              تاریخ انتخاب‌شده: {formatDate(selectedDate)}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-500">
                ثبت شده:
              </span>{" "}
              <strong className="text-slate-900">
                {recordedCount}
              </strong>{" "}
              از {allTeachers.length}
            </div>

            <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-500">
                باقی‌مانده:
              </span>{" "}
              <strong className="text-slate-900">
                {Math.max(allTeachers.length - recordedCount, 0)}
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="relative">
            <input
              value={search}
              onChange={(event) =>
                onSearchChange(event.target.value)
              }
              placeholder="جستجوی نام، رشته یا شماره تماس..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            در حال دریافت اطلاعات...
          </div>
        ) : teachers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-semibold text-slate-700">
              دبیر مورد نظر پیدا نشد.
            </p>

            <p className="mt-2 text-sm text-slate-400">
              عبارت جستجو را تغییر دهید.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-right">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                  <th className="px-5 py-4">دبیر</th>
                  <th className="px-5 py-4">رشته</th>
                  <th className="px-5 py-4">زمان ورود</th>
                  <th className="px-5 py-4">تأخیر</th>
                  <th className="px-5 py-4">وضعیت</th>
                  <th className="px-5 py-4">عملیات</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {teachers.map((teacher) => {
                  const item = attendanceMap.get(teacher.id);
                  const isSaving = savingId === teacher.id;

                  const lateMinutes =
                    getLateMinutes(teacher.id);

                  return (
                    <tr
                      key={teacher.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                            {teacher.first_name.charAt(0)}
                          </div>

                          <div>
                            <p className="font-semibold text-slate-800">
                              {teacher.first_name}{" "}
                              {teacher.last_name}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              {teacher.phone || "شماره ثبت نشده"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {teacher.subject || "-"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatTime(item?.check_in ?? null)}
                      </td>

                      <td className="px-5 py-4">
                        {item?.status === "late" ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={lateMinutes}
                              onChange={(event) =>
                                handleLateMinutesChange(
                                  teacher,
                                  event.target.value,
                                )
                              }
                              className="w-20 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-bold text-amber-700 outline-none focus:border-amber-400"
                            />

                            <span className="text-xs text-slate-500">
                              دقیقه
                            </span>

                            <button
                              onClick={() =>
                                handleLateSave(teacher)
                              }
                              disabled={isSaving}
                              className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isSaving ? "..." : "ثبت"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(
                            item?.status,
                          )}`}
                        >
                          {statusLabel(item?.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              onStatusChange(
                                teacher,
                                "present",
                              )
                            }
                            disabled={isSaving}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              item?.status === "present"
                                ? "bg-emerald-600 text-white"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            حاضر
                          </button>

                          <button
                            onClick={() =>
                              onStatusChange(
                                teacher,
                                "late",
                                Number(lateMinutes) || 10,
                              )
                            }
                            disabled={isSaving}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              item?.status === "late"
                                ? "bg-amber-500 text-white"
                                : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            }`}
                          >
                            تأخیر
                          </button>

                          <button
                            onClick={() =>
                              onStatusChange(
                                teacher,
                                "absent",
                              )
                            }
                            disabled={isSaving}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              item?.status === "absent"
                                ? "bg-red-600 text-white"
                                : "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            }`}
                          >
                            غایب
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function TeachersPage({
  teachers,
  search,
  onSearchChange,
}: {
  teachers: Teacher[];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const [selectedTeacher, setSelectedTeacher] =
    useState<Teacher | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return teachers;

    return teachers.filter((teacher) => {
      const fullName =
        `${teacher.first_name} ${teacher.last_name}`.toLowerCase();

      return (
        fullName.includes(query) ||
        (teacher.subject ?? "").toLowerCase().includes(query) ||
        (teacher.phone ?? "").includes(query)
      );
    });
  }, [teachers, search]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              فهرست دبیران
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              فهرست دبیران فعال مدرسه
            </p>
          </div>

          <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
            تعداد دبیران:{" "}
            <strong className="text-slate-900">
              {teachers.length}
            </strong>
          </div>
        </div>

        <div className="mt-6">
          <input
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            placeholder="جستجوی نام، رشته یا شماره تماس..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((teacher) => (
          <button
            key={teacher.id}
            onClick={() => setSelectedTeacher(teacher)}
            className="group rounded-3xl border border-slate-200 bg-white p-5 text-right transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-bold text-white">
                {teacher.first_name.charAt(0)}
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900">
                  {teacher.first_name} {teacher.last_name}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {teacher.subject || "رشته ثبت نشده"}
                </p>

                <p className="mt-3 text-xs text-slate-400">
                  {teacher.phone || "شماره تماس ثبت نشده"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs font-medium text-emerald-600">
                دبیر فعال
              </span>

              <span className="text-xs text-slate-400 group-hover:text-slate-700">
                مشاهده اطلاعات ←
              </span>
            </div>
          </button>
        ))}
      </section>

      {filtered.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
          <p className="font-semibold text-slate-700">
            نتیجه‌ای پیدا نشد.
          </p>
        </div>
      )}

      {selectedTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 font-bold text-white">
                    {selectedTeacher.first_name.charAt(0)}
                  </div>

                  <div>
                    <h2 className="font-bold text-slate-900">
                      {selectedTeacher.first_name}{" "}
                      {selectedTeacher.last_name}
                    </h2>

                    <p className="mt-1 text-xs text-slate-400">
                      اطلاعات دبیر
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedTeacher(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <InfoRow
                label="نام و نام خانوادگی"
                value={`${selectedTeacher.first_name} ${selectedTeacher.last_name}`}
              />

              <InfoRow
                label="رشته"
                value={selectedTeacher.subject || "-"}
              />

              <InfoRow
                label="شماره تماس"
                value={selectedTeacher.phone || "-"}
              />

              <InfoRow
                label="وضعیت"
                value="فعال"
              />
            </div>

            <button
              onClick={() => setSelectedTeacher(null)}
              className="mt-6 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-xs text-slate-400">
        {label}
      </span>

      <span className="text-sm font-semibold text-slate-700">
        {value}
      </span>
    </div>
  );
}

function ReportsPage({
  teachers,
  attendance,
  month,
  loading,
  onMonthChange,
}: {
  teachers: Teacher[];
  attendance: Attendance[];
  month: string;
  loading: boolean;
  onMonthChange: (month: string) => void;
}) {
  const teacherMap = useMemo(() => {
    const map = new Map<string, Teacher>();

    teachers.forEach((teacher) => {
      map.set(teacher.id, teacher);
    });

    return map;
  }, [teachers]);

  const reportRows = useMemo(() => {
    return teachers.map((teacher) => {
      const records = attendance.filter(
        (item) => item.teacher_id === teacher.id,
      );

      let present = 0;
      let late = 0;
      let absent = 0;
      let lateMinutes = 0;

      records.forEach((record) => {
        if (record.status === "present") {
          present++;
        }

        if (record.status === "late") {
          late++;
          lateMinutes += record.late_minutes ?? 0;
        }

        if (record.status === "absent") {
          absent++;
        }
      });

      return {
        teacher,
        present,
        late,
        absent,
        lateMinutes,
        total: records.length,
      };
    });
  }, [teachers, attendance]);

  const totals = useMemo(() => {
    return reportRows.reduce(
      (acc, row) => {
        acc.present += row.present;
        acc.late += row.late;
        acc.absent += row.absent;
        acc.lateMinutes += row.lateMinutes;

        return acc;
      },
      {
        present: 0,
        late: 0,
        absent: 0,
        lateMinutes: 0,
      },
    );
  }, [reportRows]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              گزارش ماهانه
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              گزارش حضور، غیبت و تأخیر دبیران بر اساس ماه انتخاب‌شده
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-xs font-medium text-slate-500">
              ماه:
            </span>

            <input
              type="month"
              value={month}
              onChange={(event) =>
                onMonthChange(event.target.value)
              }
              className="bg-transparent text-sm font-semibold outline-none"
            />
          </label>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportStat
          title="مجموع حضور"
          value={totals.present}
          tone="green"
        />

        <ReportStat
          title="مجموع تأخیر"
          value={totals.late}
          tone="amber"
          description={`${totals.lateMinutes} دقیقه`}
        />

        <ReportStat
          title="مجموع غیبت"
          value={totals.absent}
          tone="red"
        />

        <ReportStat
          title="دبیران"
          value={teachers.length}
          tone="gray"
          description={getMonthTitle(month)}
        />
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="font-bold text-slate-900">
            گزارش دبیران
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            {getMonthTitle(month)}
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            در حال دریافت گزارش...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-right">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                  <th className="px-5 py-4">دبیر</th>
                  <th className="px-5 py-4">حضور</th>
                  <th className="px-5 py-4">تأخیر</th>
                  <th className="px-5 py-4">مجموع دقیقه تأخیر</th>
                  <th className="px-5 py-4">غیبت</th>
                  <th className="px-5 py-4">کل ثبت</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {reportRows.map((row) => (
                  <tr
                    key={row.teacher.id}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {row.teacher.first_name}{" "}
                          {row.teacher.last_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {row.teacher.subject || "-"}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex min-w-12 justify-center rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                        {row.present}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex min-w-12 justify-center rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                        {row.late}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-slate-700">
                        {row.lateMinutes} دقیقه
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex min-w-12 justify-center rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                        {row.absent}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && reportRows.length === 0 && (
          <div className="p-12 text-center text-sm text-slate-400">
            اطلاعاتی برای این ماه وجود ندارد.
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="font-bold text-slate-900">
          جزئیات ثبت‌های ماه
        </h3>

        <p className="mt-1 text-xs text-slate-400">
          تمام رکوردهای ثبت‌شده برای ماه انتخاب‌شده
        </p>

        {attendance.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-400">
            هنوز رکوردی برای این ماه ثبت نشده است.
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {attendance.slice(0, 100).map((item) => {
              const teacher = teacherMap.get(item.teacher_id);

              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {teacher
                        ? `${teacher.first_name} ${teacher.last_name}`
                        : "دبیر حذف‌شده"}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(item.attendance_date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {item.status === "late" &&
                      item.late_minutes !== null && (
                        <span className="text-xs text-slate-500">
                          {item.late_minutes} دقیقه تأخیر
                        </span>
                      )}

                    <span
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass(
                        item.status,
                      )}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportStat({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: number;
  description?: string;
  tone: "green" | "amber" | "red" | "gray";
}) {
  const classes = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div
        className={`inline-flex rounded-xl px-3 py-2 text-xs font-bold ${classes[tone]}`}
      >
        {title}
      </div>

      <p className="mt-4 text-3xl font-black text-slate-900">
        {value}
      </p>

      {description && (
        <p className="mt-2 text-xs text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

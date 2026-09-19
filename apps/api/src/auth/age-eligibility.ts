export function isAgeEligibleOn(
  dateOfBirthIsoDate: string,
  now: Date = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirthIsoDate)) {
    return false;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number.parseInt(
    parts.find((part) => part.type === "year")?.value ?? "",
    10,
  );
  const month = Number.parseInt(
    parts.find((part) => part.type === "month")?.value ?? "",
    10,
  );
  const day = Number.parseInt(
    parts.find((part) => part.type === "day")?.value ?? "",
    10,
  );
  const [birthYear, birthMonth, birthDay] = dateOfBirthIsoDate
    .split("-")
    .map((value) => Number.parseInt(value, 10));
  if (!year || !month || !day || !birthYear || !birthMonth || !birthDay) {
    return false;
  }
  const calendar = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));
  if (
    calendar.getUTCFullYear() !== birthYear ||
    calendar.getUTCMonth() !== birthMonth - 1 ||
    calendar.getUTCDate() !== birthDay
  ) {
    return false;
  }
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) {
    age -= 1;
  }
  return age >= 18;
}

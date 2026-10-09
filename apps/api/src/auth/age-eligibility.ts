export function isAgeEligibleOn(
  dateOfBirthIsoDate: string,
  now: Date = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
): boolean {
  if (!isValidDateOfBirthOn(dateOfBirthIsoDate, now, timeZone)) {
    return false;
  }
  const { year, month, day } = localCalendarDate(now, timeZone);
  const [birthYear, birthMonth, birthDay] = dateOfBirthIsoDate
    .split("-")
    .map((value) => Number.parseInt(value, 10));
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) {
    age -= 1;
  }
  return age >= 18;
}

export function isValidDateOfBirthOn(
  dateOfBirthIsoDate: string,
  now: Date = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirthIsoDate)) {
    return false;
  }
  const { year, month, day } = localCalendarDate(now, timeZone);
  const [birthYear, birthMonth, birthDay] = dateOfBirthIsoDate
    .split("-")
    .map((value) => Number.parseInt(value, 10));
  if (!birthYear || !birthMonth || !birthDay) {
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
  return (
    birthYear < year ||
    (birthYear === year &&
      (birthMonth < month || (birthMonth === month && birthDay <= day)))
  );
}

function localCalendarDate(
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
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
  return { year, month, day };
}

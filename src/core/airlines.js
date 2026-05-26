export const AIRLINES = {
  tway: {
    id: "tway",
    name: "T'way Air",
    shortName: "T'way",
    inputLabel: "CPS original",
    outputLabel: "T'way logbook",
    excludedDuties: ["O", "EX", "2F"],
    credit: {
      blockTime(row) {
        const duty = row.duty.toUpperCase();
        if (duty === "NF") return row.blockTime ? Math.round(row.blockTime * (2 / 3)) : "";
        return row.blockTime || "";
      },
      foTime(row, helpers) {
        const duty = row.duty.toUpperCase();
        if (duty === "F" || duty === "NF") return helpers.calculateCreditedBlockTime(row);
        return "";
      },
    },
  },
};

export const DEFAULT_AIRLINE_ID = "tway";

export function getAirline(id = DEFAULT_AIRLINE_ID) {
  return AIRLINES[id] || AIRLINES[DEFAULT_AIRLINE_ID];
}

export function airlineOptions() {
  return Object.values(AIRLINES);
}

import {
  getCitiesByProvince,
  getCitiesByCommunity,
  getCommunities,
} from "spanish-cities-info";

export const autonomousCommunities = getCommunities();

export function provincesForCommunity(communityCode) {
  if (!communityCode) return [];

  return [
    ...new Set(
      getCitiesByCommunity(communityCode).map((city) => city.province),
    ),
  ].sort((first, second) => first.localeCompare(second, "es"));
}

export function townsForProvince(provinceCode) {
  if (!provinceCode) return [];

  return getCitiesByProvince(provinceCode);
}

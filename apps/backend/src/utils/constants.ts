import {
  BusinessStructure,
  CompanyType,
  KycDetails,
} from "../types/users.types";

export const OTP_EXPIRY = 5 * 60 * 1000; // 5 minutes

export const requiredKycDetails: Record<
  BusinessStructure,
  (keyof KycDetails)[] | Record<CompanyType, (keyof KycDetails)[]>
> = {
  individual: [],
  sole_proprietor: [],
  partnership_firm: [],
  company: {
    private_limited: [],
    llp: [],
    one_person_company: [],
    section_8_company: [],
    public_limited: [],
  },
};

export const requiredKycFieldMap: Record<
  BusinessStructure,
  Record<string, boolean> | Record<CompanyType, Record<string, boolean>>
> = {
  individual: {},
  sole_proprietor: {},
  partnership_firm: {},
  company: {
    private_limited: {},
    llp: {},
    one_person_company: {},
    section_8_company: {},
    public_limited: {},
  },
};

import { ProfilAccesResolver, type ProfilAccesResultat } from '@domain/services/ProfilAccesResolver';
import { CycleResolver } from '@domain/services/CycleResolver';
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';

export interface ResoudreProfilAccesDTO {
  schoolId: string;
  level?: string | null;
  eleveSmartphone?: boolean | null;
  parentSmartphone?: boolean | null;
  parentTelSimple?: boolean | null;
  ageEleve?: number | null;
  onboardingId?: string | null;
}

export class ResoudreProfilAccesUseCase {
  constructor(
    private readonly onboardingRepo: EleveOnboardingRepository,
  ) {}

  async execute(dto: ResoudreProfilAccesDTO): Promise<ProfilAccesResultat> {
    let {
      level,
      eleveSmartphone,
      parentSmartphone,
      parentTelSimple,
      ageEleve,
    } = dto;

    if (dto.onboardingId) {
      const onboarding = await this.onboardingRepo.findOnboardingById(dto.onboardingId, dto.schoolId);
      if (onboarding) {
        if (eleveSmartphone === undefined || eleveSmartphone === null) {
          eleveSmartphone = !!onboarding.eleveADispositif;
        }
        if (parentSmartphone === undefined || parentSmartphone === null) {
          parentSmartphone = !!onboarding.parentADispositif;
        }
        if (parentTelSimple === undefined || parentTelSimple === null) {
          parentTelSimple = !parentSmartphone && !!onboarding.contactTelephone;
        }
      }
    }

    const cycle = CycleResolver.resolveCycle(level ?? '');

    return ProfilAccesResolver.resoudre({
      cycle,
      eleveSmartphone: !!eleveSmartphone,
      parentSmartphone: !!parentSmartphone,
      parentTelSimple: !!parentTelSimple,
      ageEleve,
    });
  }
}

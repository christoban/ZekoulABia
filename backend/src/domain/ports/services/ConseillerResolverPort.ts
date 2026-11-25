export interface ConseillerResolverPort {
  resolverConseillersOrientation(schoolId: string): Promise<string[]>;
}

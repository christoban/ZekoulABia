import { listTemplateCatalog, type TemplateCatalogEntry } from './templateCatalog';

export class ListerTemplatesCatalogUseCase {
  execute(): { templates: TemplateCatalogEntry[] } {
    return { templates: listTemplateCatalog() };
  }
}

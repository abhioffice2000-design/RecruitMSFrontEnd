import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { ThemeService } from './services/theme.service';

/** APP_INITIALIZER factory: deps inject ThemeService; returned fn runs at bootstrap (no inject() there). */
export function themeAppInitializerFactory(theme: ThemeService): () => void {
  return () => theme.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: themeAppInitializerFactory,
      deps: [ThemeService]
    }
  ],
};

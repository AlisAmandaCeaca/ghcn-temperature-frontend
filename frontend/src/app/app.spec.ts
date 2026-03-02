import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component'; // Hier: von './app' zu './app.component' ändern

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent], // Auch hier AppComponent nutzen
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // Den Test für den 'Hello, frontend' Titel können wir löschen oder anpassen,
  // da wir die Willkommensseite ja entfernt haben.
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Prepare } from './prepare';

describe('Prepare', () => {
  let component: Prepare;
  let fixture: ComponentFixture<Prepare>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Prepare]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Prepare);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

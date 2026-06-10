/** Local asset — avoids remote Google URL 403 / Next Image failures on auth panel */
export const OPHTHALMOCARE_LOGO_PATH = '/auth/ophthalmocare-logo.svg';

/** @deprecated Use OPHTHALMOCARE_LOGO_PATH */
export const OPHTHALMOCARE_LOGO_URL = OPHTHALMOCARE_LOGO_PATH;

export const AUTH_HERO_SLIDES = [
  {
    alt: 'Retinal Imaging System',
    src: 'https://lh3.googleusercontent.com/aida/AP1WRLs4YxOw5ab6o_aHB5uWDJq0jPpEDtUd58J3PFQMBWk7vTxKPK6JJwGlROFKVN0lOutQ0EBQOX4BPBRZSlX2-kg9YzVAawTUI-NMfNG5-AD0TW2T5N3RQgHwJxTOXumWk-paCJaMKrfoycJbOlRp4f26kwDWIxbl7-iS55YRsYZSkBMASicZHj1mJ7Xo8Tv5zjvHFeo5AEJ0lvQTDj37i_I1CskVHGunq9-wyKKkDig9r2-5sVoPmLZImw',
  },
  {
    alt: 'Ophthalmologist Exam',
    src: 'https://lh3.googleusercontent.com/aida/AP1WRLsqNQmP66bK86mh2uZn78cotwzNADLTsyAHHrmwvCZN9J4uYVEAfUgBHOh5IA8iW9NxwbDMJwgZbYSvMhBiWMDmHEiTeOxs7nY0Q-yfhghFEIn6SQhcSaTWEFK8cM3b1gzpQPN-pF77lsSWMt1_rwQEKqCq9JG1lznO1XV6czuCT-tOCjAdwmRusBWBcsJV93Lhy3Dwdv2yXRQqToS7NSVFMQMa90XCogwlKqHQjDaewD7gogIgZ0znGw',
  },
  {
    alt: 'Lens Implant',
    src: 'https://lh3.googleusercontent.com/aida/AP1WRLuVeddAOq9KLlFXAw2cqZAxtFabWBJdoaZ1PKAPec-XJDtyqfOIjjepnZyG8nSYLB74zID5d3Dm6KkbPn7tLbeRv5TDH-IGdeJMVhHCEznmccffQTP6C413d8CqQnWEGZCSdU6RHmuVtARc5VNxwoI93Rtn1we91EPL5yUBIDhpyIJicUvACcMDUXHs9-FBnVCRp5PASHJ4ZOP0UfZ--oLE5MtC4bYuZL3ZIMljXaInVLIowXOfc0ICLQ',
  },
  {
    alt: 'Laser Surgery',
    src: 'https://lh3.googleusercontent.com/aida/AP1WRLvvKsFkswFsJKmv_kQg27u1jaExxFW47X2dEJ_aiKT8S1dSLvhaDYHGrZwUDPiAPgTbpFb2SAFQqMFma1Iv2ln-yPJuUTpyuHzi55YPFbb-z8G1E5weMazIZLx8ZlWMS_I0C15Mu_tM6uVVTxvx3bSTswOw9l7YqdQiAHRI4xAjkQ6i4WtRWy8nTkO8UuSAMGoVd9YewlZ6bWYBQVgiD70oi72YIzUjBptmkGa2DzyhTpTclrndaNvIow',
  },
  {
    alt: 'Team Collaboration',
    src: 'https://lh3.googleusercontent.com/aida/AP1WRLui0kbYQ4Vr8LtIKwe-dd95-pKkBQ4oD6mGb-lu3ZgjDX-jir-4Be4vi2EgHGyk8YS6ST_YKYZrStdAYuEwM9ta1WHQVEnd1cRrOvk4ZexybGN145-8eFkz7FjpHOaHMncF08fNkpAUSHc_VIoXNaQ8HvnzHyXFlf2Y3q1C_UvC1_DuDFOzUDL4nEEKRZQ83PSJ2eyccRlKYhEFqopdkGc_IPqLuoDM2l77KCZsyvbHyXh3SDee2oDI5A',
  },
] as const;

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'v4.2.1-Live';

export const SUPPORT_CONTACT = 'Clinical IT Helpdesk (Ext. 555)';

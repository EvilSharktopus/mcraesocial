export const HANDOUT_URL = 'https://docs.google.com/document/d/1WUT8stleZ05QU-Xtw9brweKWBDkV3Aw7cTMSeZ_O3fo/preview';
export const RUBRIC_URL = 'https://docs.google.com/document/d/1NRBhYnGlpOh8JExhIAu76EetO8BFQ2gfDJAQKvvMIoI/preview';

export const PENDULUM_READINGS = [
  // 1700s
  { id: '1700-1725', century: '1700s', title: '1700–1725', url: 'https://docs.google.com/document/d/1CxrMoXRj8wcPQAm4MEANORWKs_UxZo8p420xr5DW0Gw/preview' },
  { id: '1750-1800', century: '1700s', title: '1750–1800', url: 'https://docs.google.com/document/d/1BCi1c3B_nNpGoFmZE0VMPo_mi5istM5ZtBg7ttHOsEM/preview' },
  // 1800s
  { id: '1800-1825', century: '1800s', title: '1800–1825', url: 'https://docs.google.com/document/d/13tNRBn4zX8OmkESGipoggn9excsBTZlZ6Kj-suYWFeg/preview' },
  { id: '1825-1850', century: '1800s', title: '1825–1850', url: 'https://docs.google.com/document/d/1VIAzCE5qDT4V3aNl7H4Y6xU-U6HBrRgoI0d7XNc4T58/preview' },
  { id: '1850-1900', century: '1800s', title: '1850–1900', url: 'https://docs.google.com/document/d/1jl2f2BdcGDD0JdgHV1sQ7irubhuqOxtnzMJcV7L9fXI/preview' },
  // 1900s
  { id: '1900-1925', century: '1900s', title: '1900–1925', url: 'https://docs.google.com/document/d/1e3BNoJJJzdNkJQTt3RsHXcENU8AjlVxu9a2Dse0iJC4/preview' },
  { id: '1925-1940', century: '1900s', title: '1925–1940', url: 'https://docs.google.com/document/d/1YV1C0vOG__5I6wUm5gPpCNR-wNmK5-7NaMlI1idF-JQ/preview' },
  { id: '1945-1970', century: '1900s', title: '1945–1970', url: 'https://docs.google.com/document/d/1_7uczUIaq47YhPicW1lrgTvbTAYBYyyY0jPOrZ2L1IQ/preview' },
  { id: '1955-1970', century: '1900s', title: '1955–1970', url: 'https://docs.google.com/document/d/1XjjtlbV-74jVEzWSOjEbNVh0z4ihck49sIaf-PaCdoU/preview' },
  { id: '1970-1990', century: '1900s', title: '1970–1990', url: 'https://docs.google.com/document/d/1UqcP30TbhUVkwVET8-4g-601n4CyokadoyH4OJlD_Qs/preview' },
  { id: '1990-2001', century: '1900s', title: '1990–2001', url: 'https://docs.google.com/document/d/1gcRRnIlXHzZR_sZ5MqZJveeMKKJjbSc4-YvtQmo0Yk4/preview' },
  // 2000s
  { id: '2001-2010', century: '2000s', title: '2001–2010', url: 'https://docs.google.com/document/d/1UPGkuMddSdDAOpYVTGll3gH7Lr5ospzPcZhiVeKaQFs/preview' },
  { id: '2010-2020', century: '2000s', title: '2010–2020', url: 'https://docs.google.com/document/d/1kXTpDP6MflYB6BnqPgTOSTzNAjJact0EKOZtWUy7UzA/preview' },
  { id: '2021-2026', century: '2000s', title: '2021–2026', url: 'https://docs.google.com/document/d/1Vb-F7-bQl7aeukaOnu6zvUf4PRLA2LJn_DKky3qcf2I/preview' },
];

// Older ranges kept for reference — shown on the teacher Archive tab, hidden
// from students. Several of these documents are reused by the list above.
export const ARCHIVED_READINGS = [
  { id: '1725-1750', century: '18th Century', title: '1725 - 1750', url: 'https://docs.google.com/document/d/1K8piZBsOtC6IKcU6zbF6hUso6FrGxw-5jXy_c8wGpnc/preview', archived: true },
  { id: '1775-1800', century: '18th Century', title: '1775 - 1800', url: 'https://docs.google.com/document/d/13HTe8x80iOeC-v2TMTFYSNJuAy5aHpfwjAR9HSS0DwU/preview', archived: true },
  { id: '1875-1900', century: '19th Century', title: '1875 - 1900', url: 'https://docs.google.com/document/d/1KUYp120m1l8Dya6van_5vsFMByo5TL9SoBpWe2uCe4Y/preview', archived: true },
  { id: '2015-2020', century: '21st Century', title: '2015 - 2020', url: 'https://docs.google.com/document/d/1Toigq3iwifWc1CgQCIBOP1VecNdl7Ypw-pND_6cMp3o/preview', archived: true },
  { id: '2022-2024', century: '21st Century', title: '2022 - 2024', url: 'https://docs.google.com/document/d/1Ifa_QCVY4iDVKbbjbh2bPyFd_MNpIxwRc-xm9WH4ajM/preview', archived: true },
  { id: '2024-2026', century: '21st Century', title: '2024 - 2026', url: 'https://docs.google.com/document/d/1WryHNvANuRKXVJlvMjfCWV1hEOY679mFsSjlpzTAkQs/preview', archived: true },
];

// Spectrum bands. A raw -100..100 value means little on its own, so both the
// teacher view and the student's own summary read as one of these.
export const POSITION_BANDS = [
  { max: -67, label: 'Extreme left' },
  { max: -34, label: 'Moderate left' },
  { max:   0, label: 'Centrist left' },
  { max:  34, label: 'Centrist right' },
  { max:  67, label: 'Moderate right' },
  { max: 101, label: 'Extreme right' },
];

export function positionLabel(value) {
  if (typeof value !== 'number') return null;
  return POSITION_BANDS.find(b => value < b.max)?.label ?? 'Extreme right';
}

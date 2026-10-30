# Role and permission matrix

| Capability | Student | Employer | Workplace supervisor | Academic supervisor | Admin |
|---|---:|---:|---:|---:|---:|
| Maintain own profile | Yes | Yes | Yes | Yes | Yes |
| Discover published opportunities | Yes | Own postings | Read assigned context | Read assigned context | All |
| Apply to opportunities | Yes | No | No | No | Oversight |
| Manage own applicants | No | Yes | No | No | Oversight |
| View assigned placement | Own | Own company | Assigned only | Assigned only | All |
| Create/edit own logbook | Own | No | No | No | Oversight |
| Review logbook | No | No | Assigned interns | Assigned students | Oversight |
| Publish grades | No | No | No | Authorized workflow | Configure/override |
| Approve employers/users | No | No | No | No | Yes |
| Manage institution settings | No | No | No | No | Yes |

Database RLS is the security boundary. The matrix is a product-level summary; every new table and mutation requires a policy and negative authorization tests.

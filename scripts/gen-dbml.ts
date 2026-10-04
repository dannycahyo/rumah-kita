import { pgGenerate } from 'drizzle-dbml-generator';
import * as schema from '../app/db/schema';

pgGenerate({ schema, out: './docs/db.dbml', relational: false });

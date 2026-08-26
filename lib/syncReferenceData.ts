import clientPromise from "@/lib/db";
import { Book } from "@/lib/models/Book";

export async function syncReferenceData() {
  const client = await clientPromise;
  const db = client.db("library");

  const booksCollection = db.collection<Book>("books");
  const languagesCollection = db.collection("languages");
  const tagsCollection = db.collection("tags");

  const books = await booksCollection
    .find(
      {},
      {
        projection: {
          title: 1,
          tags: 1,
          languages: 1,
          languageCodes: 1,
        },
      }
    )
    .toArray();

  // =========================================================
  // LANGUAGES
  // =========================================================

  const languageMap = new Map<
    string,
    {
      name: string;
      bookCount: number;
      sampleBooks: string[];
    }
  >();

  for (const book of books) {
    const codes = book.languageCodes || [];
    const names = book.languages || [];

    codes.forEach((code, index) => {
      const name = names[index];

      if (!code || !name) {
        return;
      }

      if (!languageMap.has(code)) {
        languageMap.set(code, {
          name,
          bookCount: 0,
          sampleBooks: [],
        });
      }

      const entry = languageMap.get(code)!;

      entry.bookCount += 1;

      if (book.title) {
        entry.sampleBooks.push(book.title);
      }
    });
  }

  // Полностью пересобираем languages
  await languagesCollection.deleteMany({});

  for (const [code, data] of languageMap) {
    await languagesCollection.insertOne({
      code,
      name: data.name,
      bookCount: data.bookCount,
      sampleBooks: data.sampleBooks.slice(0, 5),
      updatedAt: new Date(),
    });
  }

  // =========================================================
  // TAGS
  // =========================================================

  const tagMap = new Map<
    string,
    {
      bookCount: number;
      sampleBooks: string[];
      languages: Set<string>;
    }
  >();

  for (const book of books) {
    const tags = book.tags || [];
    const languageCodes = book.languageCodes || [];

    for (const tag of tags) {
      if (!tag) {
        continue;
      }

      if (!tagMap.has(tag)) {
        tagMap.set(tag, {
          bookCount: 0,
          sampleBooks: [],
          languages: new Set<string>(),
        });
      }

      const entry = tagMap.get(tag)!;

      entry.bookCount += 1;

      if (book.title) {
        entry.sampleBooks.push(book.title);
      }

      for (const code of languageCodes) {
        if (code) {
          entry.languages.add(code);
        }
      }
    }
  }

  // Полностью пересобираем tags
  await tagsCollection.deleteMany({});

  for (const [name, data] of tagMap) {
    await tagsCollection.insertOne({
      name,
      bookCount: data.bookCount,
      sampleBooks: data.sampleBooks.slice(0, 3),
      uniqueLanguages: Array.from(data.languages),
      updatedAt: new Date(),
    });
  }

  // Индексы
  await languagesCollection.createIndex(
    { code: 1 },
    {
      unique: true,
      name: "code_unique_idx",
    }
  );

  await tagsCollection.createIndex(
    { name: 1 },
    {
      unique: true,
      name: "tag_name_idx",
    }
  );

  await tagsCollection.createIndex(
    { bookCount: -1 },
    {
      name: "tag_count_idx",
    }
  );

  console.log(
    `Reference data synced: ${languageMap.size} languages, ${tagMap.size} tags`
  );
}

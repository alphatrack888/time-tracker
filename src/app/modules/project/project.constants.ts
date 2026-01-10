export const projectFilterables = ['searchTerm','status','description','title'];
export const projectSearchableFields = ['title','description'];


export   const isSetEqual = (a: Set<string>, b: Set<string>) => {
    if (a.size !== b.size) return false;
    for (const elem of a) {
      if (!b.has(elem)) return false;
    }
    return true;
  }

// Subcategories definition and note parsing utilities

export const SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
  food: ['Eating Out', 'Delivery', 'Groceries', 'Cafe', 'Date', 'Drinks'],
  dining: ['Eating Out', 'Delivery', 'Cafe', 'Date', 'Drinks'],
  restaurant: ['Eating Out', 'Delivery', 'Cafe', 'Date', 'Drinks'],
  grocery: ['Supermarket', 'Veggies/Fruit', 'Snacks', 'Pantry'],
  transport: ['Metro/Transit', 'Cab/Uber', 'Fuel', 'Auto', 'Flight'],
  commute: ['Metro/Transit', 'Cab/Uber', 'Fuel', 'Train'],
  shopping: ['Apparel', 'Electronics', 'Home Goods', 'Personal', 'Footwear'],
  bills: ['Rent', 'Electricity', 'Wi-Fi/Mobile', 'Subscriptions', 'EMI/Loan', 'Water'],
  utilities: ['Electricity', 'Water', 'Gas', 'Wi-Fi/Mobile'],
  entertainment: ['Movies', 'Gaming', 'Outing', 'Concert', 'Streaming'],
  health: ['Pharmacy', 'Doctor/Clinic', 'Gym/Fitness', 'Supplements'],
  fitness: ['Gym Membership', 'Supplements', 'Equipment', 'Sports'],
  tech: ['Gadgets', 'Software', 'Accessories', 'Hardware'],
  salary: ['Monthly Salary', 'Bonus', 'Overtime', 'Arrears'],
  freelance: ['Client Project', 'Consulting', 'Side Gig'],
  gift: ['Family', 'Friend', 'Holiday'],
  other: ['General', 'Personal', 'Services'],
};

export function getSubcategoriesForCategory(catName?: string | null): string[] {
  if (!catName) return ['General', 'Personal', 'Services'];
  const key = catName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (SUBCATEGORIES_BY_CATEGORY[key]) {
    return SUBCATEGORIES_BY_CATEGORY[key];
  }
  for (const [k, list] of Object.entries(SUBCATEGORIES_BY_CATEGORY)) {
    if (key.includes(k) || k.includes(key)) {
      return list;
    }
  }
  return ['General', 'Personal', 'Services'];
}

export function parseTransactionNote(rawNote: string | null): {
  subcategory: string | null;
  detail: string | null;
} {
  if (!rawNote) return { subcategory: null, detail: null };
  const trimmed = rawNote.trim();

  // Pattern 1: [Subcategory] Detail
  const bracketMatch = trimmed.match(/^\[(.*?)\]\s*(.*)$/);
  if (bracketMatch) {
    return {
      subcategory: bracketMatch[1].trim() || null,
      detail: bracketMatch[2].trim() || null,
    };
  }

  // Pattern 2: Subcategory • Detail
  const dotMatch = trimmed.match(/^(.*?)\s*•\s*(.*)$/);
  if (dotMatch) {
    return {
      subcategory: dotMatch[1].trim() || null,
      detail: dotMatch[2].trim() || null,
    };
  }

  // Pattern 3: Subcategory (if it matches known subcategory exactly)
  for (const list of Object.values(SUBCATEGORIES_BY_CATEGORY)) {
    for (const item of list) {
      if (item.toLowerCase() === trimmed.toLowerCase()) {
        return { subcategory: item, detail: null };
      }
    }
  }

  return { subcategory: null, detail: trimmed };
}

export function formatTransactionNote(subcategory: string | null, detail: string | null): string | null {
  const cleanSub = subcategory?.trim() || null;
  const cleanDet = detail?.trim() || null;

  if (cleanSub && cleanDet) {
    return `[${cleanSub}] ${cleanDet}`;
  }
  if (cleanSub) {
    return `[${cleanSub}]`;
  }
  return cleanDet;
}

// What a tracker page shows, per layout and page (02 §1–2, §4).
//   lanes: 'brands' (one lane per brand), 'people' (one per PIC), 'me' (my brands, PIC = me)

const ALL = () => true;

export function buildView({ role, brands, kind, brandId, isAdmin, me }) {
  if (!role) return { redirect: '/' };
  const base = `/t/${role.id}`;

  switch (role.layout) {
    case 'single': {
      if (kind !== 'main') return { redirect: base };
      const brand = brands[0];
      return {
        key: 'single',
        title: brand?.name ?? role.name,
        crumb: null,
        brandChoices: brands,
        showBrand: false,
        showPic: false,
        lanes: 'brands',
        laneBrands: brands,
        filter: ALL,
      };
    }

    case 'multi_brand': {
      if (kind === 'brand') {
        const brand = brands.find((b) => b.id === brandId);
        if (!brand) return { redirect: base };
        return {
          key: `brand:${brand.id}`,
          title: brand.name,
          crumb: role.name,
          brandChoices: [brand],
          showBrand: false,
          showPic: false,
          lanes: 'brands',
          laneBrands: [brand],
          filter: (i) => i.brand_id === brand.id,
        };
      }
      if (kind === 'master') return { redirect: base };
      return {
        key: 'master',
        title: 'Master',
        crumb: role.name,
        brandChoices: brands,
        showBrand: true,
        showPic: false,
        lanes: 'brands',
        laneBrands: brands,
        filter: ALL,
      };
    }

    case 'team': {
      if (kind === 'brand') return { redirect: base };
      if (kind === 'main' && isAdmin) return { redirect: `${base}/master` }; // Admin has no lane of their own
      if (kind === 'master') {
        return {
          key: 'master',
          title: 'Master',
          crumb: role.name,
          brandChoices: brands,
          showBrand: true,
          showPic: true,
          lanes: 'people',
          laneBrands: brands,
          filter: ALL,
          extras: true,
        };
      }
      return {
        key: 'mine',
        title: 'My work',
        crumb: role.name,
        brandChoices: brands,
        showBrand: true,
        showPic: false,
        lanes: 'me',
        laneBrands: brands,
        filter: (i) => i.pic_id === me, // My work = items where I am the PIC (09 §6)
        teamLine: true,
      };
    }

    default:
      return { redirect: '/' };
  }
}

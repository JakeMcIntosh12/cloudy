export default {
  name: "wedding",
  title: "Wedding",
  type: "document",

  fields: [
    {
      name: "title",
      title: "Couple / Project Name",
      type: "string",
      validation: (Rule) => Rule.required(),
    },

    {
      name: "year",
      title: "Year",
      type: "number",
      validation: (Rule) =>
        Rule.required().integer().min(1900).max(2100),
    },

    {
      name: "videos",
      title: "Wedding Videos",
      description:
        "Paste the Bunny Stream HLS playlist URL for each wedding video.",
      type: "array",
      of: [
        {
          type: "object",
          name: "weddingVideo",
          title: "Wedding Video",
          fields: [
            {
              name: "url",
              title: "Bunny Video URL",
              description:
                "Paste the Bunny Stream HLS playlist URL ending in /playlist.m3u8",
              type: "url",
              validation: (Rule) =>
                Rule.required().custom((value) => {
                  if (!value) return true;

                  if (
                    !value.includes(".b-cdn.net/") ||
                    !value.includes("/playlist.m3u8")
                  ) {
                    return "Please enter a valid Bunny Stream HLS playlist URL.";
                  }

                  return true;
                }),
            },
          ],

          preview: {
            select: {
              url: "url",
            },
            prepare({ url }) {
              return {
                title: "Bunny Video",
                subtitle: url || "No Bunny URL",
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.max(5).error("A wedding can have a maximum of 5 videos."),
    },
  ],

  preview: {
    select: {
      title: "title",
      year: "year",
    },
    prepare({ title, year }) {
      return {
        title: title || "Untitled Wedding",
        subtitle: year ? String(year) : "No year",
      };
    },
  },
};
import { defineField, defineType } from "sanity";

export default defineType({
  name: "caseStudy",
  title: "Case Study",
  type: "document",

  fields: [
    // =========================================================
    // PROJECT TITLE
    // =========================================================

    defineField({
      name: "title",
      title: "Project Title",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),

    // =========================================================
    // SLUG
    // =========================================================

    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",

      options: {
        source: "title",
        maxLength: 96,
        slugify: (input) =>
          input
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]+/g, "")
            .replace(/\-\-+/g, "-"),
      },
    }),

    // =========================================================
    // CLIENT
    // =========================================================

    defineField({
      name: "client",
      title: "Client",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),

    // =========================================================
    // PROJECT ORDERING
    // =========================================================

    defineField({
      name: "order",
      title: "Project Order",
      type: "number",
      description:
        "Controls the order projects appear across the website.",
    }),

    // =========================================================
    // HERO VIDEOS — BUNNY STREAM
    // =========================================================

    defineField({
      name: "heroVideos",
      title: "Hero Videos",
      description:
        "Paste Bunny Stream HLS (.m3u8) URLs here. Upload and manage the videos in Bunny Stream, then paste the HLS URL into this field.",

      type: "array",

      of: [
        {
          type: "object",
          name: "heroVideo",
          title: "Hero Video",

          fields: [
            defineField({
              name: "videoUrl",
              title: "Bunny HLS URL",
              description:
                "Paste the Bunny Stream HLS playlist URL ending in /playlist.m3u8",

              type: "url",

              validation: (Rule) =>
                Rule.required().custom((value) => {
                  if (!value) return true;

                  if (!value.endsWith(".m3u8")) {
                    return "Please enter a Bunny HLS URL ending in /playlist.m3u8";
                  }

                  if (!value.includes("b-cdn.net")) {
                    return "Please enter a Bunny Stream CDN URL.";
                  }

                  return true;
                }),
            }),
          ],

          preview: {
            select: {
              videoUrl: "videoUrl",
            },

            prepare({ videoUrl }) {
              return {
                title: "Bunny Stream Video",
                subtitle: videoUrl || "No Bunny URL",
              };
            },
          },
        },
      ],
    }),

    // =========================================================
    // PROJECT OVERVIEW
    // =========================================================

    defineField({
      name: "overview",
      title: "Project Overview",
      type: "text",
      rows: 6,
    }),

    // =========================================================
    // SERVICES
    // =========================================================

    defineField({
      name: "services",
      title: "Services",
      type: "array",

      of: [
        {
          type: "string",
        },
      ],
    }),

    // =========================================================
    // DATE
    // =========================================================

    defineField({
      name: "date",
      title: "Date",
      type: "string",
    }),

    // =========================================================
    // CREDITS
    // =========================================================

    defineField({
      name: "credits",
      title: "Credits",
      description:
        "Add everyone involved in the project, including architects, designers, stylists, builders, photographers, and other collaborators.",

      type: "array",

      of: [
        {
          type: "object",
          name: "credit",
          title: "Credit",

          fields: [
            defineField({
              name: "name",
              title: "Name",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),

            defineField({
              name: "role",
              title: "Role",
              type: "string",
            }),
          ],

          preview: {
            select: {
              title: "name",
              subtitle: "role",
            },
          },
        },
      ],
    }),

    // =========================================================
    // GALLERY
    // =========================================================

    defineField({
      name: "gallery",
      title: "Gallery",

      description:
        "Upload up to 26 images or videos. Portrait and landscape media are supported.",

      type: "array",

      validation: (Rule) =>
        Rule.max(26).error(
          "You can upload a maximum of 26 gallery items."
        ),

      options: {
        layout: "grid",
      },

      of: [
        {
          type: "image",

          options: {
            hotspot: true,
          },
        },

        {
          type: "file",

          options: {
            accept: "video/*",
          },
        },
      ],
    }),
  ],

  // ===========================================================
  // DOCUMENT PREVIEW
  // ===========================================================

  preview: {
    select: {
      title: "title",
      client: "client",
      media: "gallery.0",
    },

    prepare({ title, client, media }) {
      return {
        title: title || "Untitled Project",
        subtitle: client || "No client",
        media,
      };
    },
  },
});
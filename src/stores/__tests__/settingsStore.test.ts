import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "../settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useSettingsStore.setState({
      defaultTags: [
        "investor",
        "builder",
        "enterprise",
        "community",
        "personal",
        "colleague",
        "candidate",
        "defi",
        "founder",
      ],
    });
  });

  describe("initial state", () => {
    it("has correct initial default tags", () => {
      const state = useSettingsStore.getState();
      expect(state.defaultTags).toContain("investor");
      expect(state.defaultTags).toContain("builder");
      expect(state.defaultTags).toContain("founder");
      expect(state.defaultTags.length).toBe(9);
    });
  });

  describe("addDefaultTag", () => {
    it("adds a new tag", () => {
      useSettingsStore.getState().addDefaultTag("newTag");
      expect(useSettingsStore.getState().defaultTags).toContain("newtag");
    });

    it("normalizes tag to lowercase", () => {
      useSettingsStore.getState().addDefaultTag("NewTag");
      expect(useSettingsStore.getState().defaultTags).toContain("newtag");
    });

    it("trims whitespace", () => {
      useSettingsStore.getState().addDefaultTag("  spaced  ");
      expect(useSettingsStore.getState().defaultTags).toContain("spaced");
    });

    it("does not add duplicate tags", () => {
      const initialLength = useSettingsStore.getState().defaultTags.length;
      useSettingsStore.getState().addDefaultTag("investor"); // Already exists
      expect(useSettingsStore.getState().defaultTags.length).toBe(initialLength);
    });

    it("does not add empty tags", () => {
      const initialLength = useSettingsStore.getState().defaultTags.length;
      useSettingsStore.getState().addDefaultTag("");
      useSettingsStore.getState().addDefaultTag("   ");
      expect(useSettingsStore.getState().defaultTags.length).toBe(initialLength);
    });

    it("keeps tags sorted", () => {
      useSettingsStore.getState().addDefaultTag("aaa");
      const tags = useSettingsStore.getState().defaultTags;
      expect(tags[0]).toBe("aaa");
    });
  });

  describe("removeDefaultTag", () => {
    it("removes an existing tag", () => {
      useSettingsStore.getState().removeDefaultTag("investor");
      expect(useSettingsStore.getState().defaultTags).not.toContain("investor");
    });

    it("does nothing for non-existent tag", () => {
      const initialLength = useSettingsStore.getState().defaultTags.length;
      useSettingsStore.getState().removeDefaultTag("nonexistent");
      expect(useSettingsStore.getState().defaultTags.length).toBe(initialLength);
    });
  });

  describe("resetDefaultTags", () => {
    it("resets to initial tags", () => {
      useSettingsStore.getState().addDefaultTag("custom");
      useSettingsStore.getState().removeDefaultTag("investor");
      useSettingsStore.getState().resetDefaultTags();

      const tags = useSettingsStore.getState().defaultTags;
      expect(tags).toContain("investor");
      expect(tags).not.toContain("custom");
      expect(tags.length).toBe(9);
    });
  });
});

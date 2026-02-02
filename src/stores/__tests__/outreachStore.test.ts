import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useOutreachStore } from "../outreachStore";

vi.mock("@tauri-apps/api/core");

const mockInvoke = vi.mocked(invoke);

describe("outreachStore", () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useOutreachStore.setState({
      template: "",
      selectedRecipientIds: [],
      activeQueue: null,
      queues: [],
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("has correct initial state", () => {
      const state = useOutreachStore.getState();
      expect(state.template).toBe("");
      expect(state.selectedRecipientIds).toEqual([]);
      expect(state.activeQueue).toBeNull();
      expect(state.queues).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("setTemplate", () => {
    it("updates template", () => {
      useOutreachStore.getState().setTemplate("Hello {name}!");
      expect(useOutreachStore.getState().template).toBe("Hello {name}!");
    });
  });

  describe("selectRecipients", () => {
    it("sets recipient ids", () => {
      useOutreachStore.getState().selectRecipients([1, 2, 3]);
      expect(useOutreachStore.getState().selectedRecipientIds).toEqual([1, 2, 3]);
    });

    it("replaces existing recipients", () => {
      useOutreachStore.setState({ selectedRecipientIds: [1, 2] });
      useOutreachStore.getState().selectRecipients([4, 5]);
      expect(useOutreachStore.getState().selectedRecipientIds).toEqual([4, 5]);
    });
  });

  describe("toggleRecipient", () => {
    it("adds recipient if not selected", () => {
      useOutreachStore.setState({ selectedRecipientIds: [1, 2] });
      useOutreachStore.getState().toggleRecipient(3);
      expect(useOutreachStore.getState().selectedRecipientIds).toContain(3);
    });

    it("removes recipient if already selected", () => {
      useOutreachStore.setState({ selectedRecipientIds: [1, 2, 3] });
      useOutreachStore.getState().toggleRecipient(2);
      expect(useOutreachStore.getState().selectedRecipientIds).toEqual([1, 3]);
    });
  });

  describe("selectByTag", () => {
    it("adds contacts with matching tag", () => {
      useOutreachStore.setState({ selectedRecipientIds: [1] });
      const contacts = [
        { userId: 2, tags: ["vip", "customer"] },
        { userId: 3, tags: ["customer"] },
        { userId: 4, tags: ["other"] },
      ];

      useOutreachStore.getState().selectByTag("customer", contacts);

      const selected = useOutreachStore.getState().selectedRecipientIds;
      expect(selected).toContain(1); // Original
      expect(selected).toContain(2);
      expect(selected).toContain(3);
      expect(selected).not.toContain(4);
    });

    it("does not duplicate already selected contacts", () => {
      useOutreachStore.setState({ selectedRecipientIds: [2] });
      const contacts = [
        { userId: 2, tags: ["vip"] },
        { userId: 3, tags: ["vip"] },
      ];

      useOutreachStore.getState().selectByTag("vip", contacts);

      const selected = useOutreachStore.getState().selectedRecipientIds;
      expect(selected).toHaveLength(2);
      expect(selected).toEqual([2, 3]);
    });
  });

  describe("startOutreach", () => {
    it("validates template and recipients", async () => {
      useOutreachStore.setState({ template: "", selectedRecipientIds: [1] });
      await useOutreachStore.getState().startOutreach();

      expect(useOutreachStore.getState().error).toBe(
        "Template and recipients are required"
      );
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("validates recipients exist", async () => {
      useOutreachStore.setState({ template: "Hello!", selectedRecipientIds: [] });
      await useOutreachStore.getState().startOutreach();

      expect(useOutreachStore.getState().error).toBe(
        "Template and recipients are required"
      );
    });

    it("starts outreach successfully", async () => {
      useOutreachStore.setState({
        template: "Hello {name}!",
        selectedRecipientIds: [1, 2],
      });

      const queueStatus = {
        id: "queue-123",
        template: "Hello {name}!",
        recipients: [
          { userId: 1, firstName: "Test", status: "pending" },
          { userId: 2, firstName: "User", status: "pending" },
        ],
        status: "running",
        sentCount: 0,
        failedCount: 0,
      };

      mockInvoke
        .mockResolvedValueOnce("queue-123") // queueOutreachMessages
        .mockResolvedValueOnce(queueStatus); // getOutreachStatus

      await useOutreachStore.getState().startOutreach();

      expect(mockInvoke).toHaveBeenCalledWith("queue_outreach_messages", {
        recipientIds: [1, 2],
        template: "Hello {name}!",
      });
      expect(useOutreachStore.getState().activeQueue).toEqual(queueStatus);
      expect(useOutreachStore.getState().queues).toHaveLength(1);
    });

    it("handles start errors", async () => {
      useOutreachStore.setState({
        template: "Hello!",
        selectedRecipientIds: [1],
      });
      mockInvoke.mockRejectedValueOnce(new Error("Rate limited"));

      await useOutreachStore.getState().startOutreach();

      expect(useOutreachStore.getState().error).toBe("Error: Rate limited");
      expect(useOutreachStore.getState().isLoading).toBe(false);
    });
  });

  describe("cancelOutreach", () => {
    it("cancels active queue", async () => {
      const queue = {
        id: "queue-123",
        template: "Hello!",
        recipients: [],
        status: "running" as const,
        sentCount: 0,
        failedCount: 0,
      };
      useOutreachStore.setState({ activeQueue: queue });
      mockInvoke.mockResolvedValueOnce(undefined);

      await useOutreachStore.getState().cancelOutreach();

      expect(mockInvoke).toHaveBeenCalledWith("cancel_outreach", {
        queueId: "queue-123",
      });
      expect(useOutreachStore.getState().activeQueue?.status).toBe("cancelled");
    });

    it("does nothing if no active queue", async () => {
      await useOutreachStore.getState().cancelOutreach();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("handles cancel errors", async () => {
      useOutreachStore.setState({
        activeQueue: {
          id: "queue-123",
          template: "",
          recipients: [],
          status: "running",
          sentCount: 0,
          failedCount: 0,
        },
      });
      mockInvoke.mockRejectedValueOnce(new Error("Cancel failed"));

      await useOutreachStore.getState().cancelOutreach();

      expect(useOutreachStore.getState().error).toBe("Error: Cancel failed");
    });
  });

  describe("refreshStatus", () => {
    it("refreshes active queue status", async () => {
      const initialQueue = {
        id: "queue-123",
        template: "Hello!",
        recipients: [],
        status: "running" as const,
        sentCount: 0,
        failedCount: 0,
      };
      useOutreachStore.setState({ activeQueue: initialQueue });

      const updatedQueue = { ...initialQueue, sentCount: 5 };
      mockInvoke.mockResolvedValueOnce(updatedQueue);

      await useOutreachStore.getState().refreshStatus();

      expect(mockInvoke).toHaveBeenCalledWith("get_outreach_status", {
        queueId: "queue-123",
      });
      expect(useOutreachStore.getState().activeQueue?.sentCount).toBe(5);
    });

    it("does nothing if no active queue", async () => {
      await useOutreachStore.getState().refreshStatus();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("does nothing if queue is completed", async () => {
      useOutreachStore.setState({
        activeQueue: {
          id: "queue-123",
          template: "",
          recipients: [],
          status: "completed",
          sentCount: 10,
          failedCount: 0,
        },
      });

      await useOutreachStore.getState().refreshStatus();

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("resets state to defaults", () => {
      useOutreachStore.setState({
        template: "Hello!",
        selectedRecipientIds: [1, 2, 3],
        activeQueue: {
          id: "q",
          template: "",
          recipients: [],
          status: "running",
          sentCount: 0,
          failedCount: 0,
        },
        isLoading: true,
        error: "Some error",
      });

      useOutreachStore.getState().reset();

      const state = useOutreachStore.getState();
      expect(state.template).toBe("");
      expect(state.selectedRecipientIds).toEqual([]);
      expect(state.activeQueue).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("previewMessage", () => {
    it("replaces {name} with first name", () => {
      useOutreachStore.setState({ template: "Hello {name}!" });
      const contacts = [{ userId: 1, firstName: "John", lastName: "Doe" }];

      const result = useOutreachStore.getState().previewMessage(1, contacts);

      expect(result).toBe("Hello John!");
    });

    it("replaces {first_name} with first name", () => {
      useOutreachStore.setState({ template: "Hi {first_name}!" });
      const contacts = [{ userId: 1, firstName: "Jane", lastName: "Doe" }];

      const result = useOutreachStore.getState().previewMessage(1, contacts);

      expect(result).toBe("Hi Jane!");
    });

    it("replaces {last_name} with last name", () => {
      useOutreachStore.setState({ template: "Dear {last_name}" });
      const contacts = [{ userId: 1, firstName: "John", lastName: "Smith" }];

      const result = useOutreachStore.getState().previewMessage(1, contacts);

      expect(result).toBe("Dear Smith");
    });

    it("replaces {full_name} with full name", () => {
      useOutreachStore.setState({ template: "Hello {full_name}!" });
      const contacts = [{ userId: 1, firstName: "John", lastName: "Doe" }];

      const result = useOutreachStore.getState().previewMessage(1, contacts);

      expect(result).toBe("Hello John Doe!");
    });

    it("handles missing contact", () => {
      useOutreachStore.setState({ template: "Hello {name}!" });

      const result = useOutreachStore.getState().previewMessage(999, []);

      expect(result).toBe("Hello {name}!");
    });

    it("uses 'there' as fallback for missing first name", () => {
      useOutreachStore.setState({ template: "Hello {name}!" });
      const contacts = [{ userId: 1, firstName: "", lastName: "Doe" }];

      const result = useOutreachStore.getState().previewMessage(1, contacts);

      expect(result).toBe("Hello there!");
    });

    it("handles contact with only first name", () => {
      useOutreachStore.setState({ template: "Hello {full_name}!" });
      const contacts = [{ userId: 1, firstName: "John", lastName: "" }];

      const result = useOutreachStore.getState().previewMessage(1, contacts);

      expect(result).toBe("Hello John!");
    });

    it("replaces multiple placeholders", () => {
      useOutreachStore.setState({
        template: "Hi {first_name}, your name is {full_name}!",
      });
      const contacts = [{ userId: 1, firstName: "John", lastName: "Doe" }];

      const result = useOutreachStore.getState().previewMessage(1, contacts);

      expect(result).toBe("Hi John, your name is John Doe!");
    });
  });

  describe("clearError", () => {
    it("clears the error", () => {
      useOutreachStore.setState({ error: "Some error" });
      useOutreachStore.getState().clearError();
      expect(useOutreachStore.getState().error).toBeNull();
    });
  });
});

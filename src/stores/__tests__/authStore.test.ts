import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "../authStore";

vi.mock("@tauri-apps/api/core");

const mockInvoke = vi.mocked(invoke);

describe("authStore", () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useAuthStore.setState({
      authState: { type: "waitPhoneNumber" },
      currentUser: null,
      isLoading: false,
      isConnecting: true,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("has correct initial state", () => {
      const state = useAuthStore.getState();
      expect(state.authState).toEqual({ type: "waitPhoneNumber" });
      expect(state.currentUser).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isConnecting).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe("setAuthState", () => {
    it("updates authState", () => {
      useAuthStore.getState().setAuthState({ type: "ready" });
      expect(useAuthStore.getState().authState).toEqual({ type: "ready" });
    });
  });

  describe("setCurrentUser", () => {
    it("updates currentUser", () => {
      const user = { id: 123, firstName: "Test", lastName: "User" } as any;
      useAuthStore.getState().setCurrentUser(user);
      expect(useAuthStore.getState().currentUser).toEqual(user);
    });

    it("can clear currentUser", () => {
      useAuthStore.setState({ currentUser: { id: 1, firstName: "Test", lastName: "User" } as any });
      useAuthStore.getState().setCurrentUser(null);
      expect(useAuthStore.getState().currentUser).toBeNull();
    });
  });

  describe("connect", () => {
    it("sets ready state when already authorized", async () => {
      const user = { id: 123, firstName: "Test", lastName: "" } as any;
      mockInvoke
        .mockResolvedValueOnce(true) // connect returns true
        .mockResolvedValueOnce(user); // getCurrentUser returns user

      await useAuthStore.getState().connect();

      expect(mockInvoke).toHaveBeenCalledWith("connect");
      expect(mockInvoke).toHaveBeenCalledWith("get_current_user");
      expect(useAuthStore.getState().authState).toEqual({ type: "ready" });
      expect(useAuthStore.getState().currentUser).toEqual(user);
      expect(useAuthStore.getState().isConnecting).toBe(false);
    });

    it("sets waitPhoneNumber state when not authorized", async () => {
      mockInvoke.mockResolvedValueOnce(false); // connect returns false

      await useAuthStore.getState().connect();

      expect(useAuthStore.getState().authState).toEqual({ type: "waitPhoneNumber" });
      expect(useAuthStore.getState().isConnecting).toBe(false);
    });

    it("handles connection errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Network error"));

      await useAuthStore.getState().connect();

      expect(useAuthStore.getState().error).toBe("Error: Network error");
      expect(useAuthStore.getState().isConnecting).toBe(false);
    });
  });

  describe("sendPhoneNumber", () => {
    it("sends phone number and updates state", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await useAuthStore.getState().sendPhoneNumber("+1234567890");

      expect(mockInvoke).toHaveBeenCalledWith("send_phone_number", {
        phoneNumber: "+1234567890",
      });
      expect(useAuthStore.getState().authState).toEqual({
        type: "waitCode",
        phoneNumber: "+1234567890",
      });
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("handles errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Invalid phone"));

      await useAuthStore.getState().sendPhoneNumber("+invalid");

      expect(useAuthStore.getState().error).toBe("Error: Invalid phone");
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe("sendAuthCode", () => {
    it("authenticates successfully and gets user", async () => {
      const user = { id: 123, firstName: "Test", lastName: "" } as any;
      mockInvoke
        .mockResolvedValueOnce(undefined) // sendAuthCode
        .mockResolvedValueOnce(user); // getCurrentUser

      await useAuthStore.getState().sendAuthCode("12345");

      expect(mockInvoke).toHaveBeenCalledWith("send_auth_code", { code: "12345" });
      expect(useAuthStore.getState().authState).toEqual({ type: "ready" });
      expect(useAuthStore.getState().currentUser).toEqual(user);
    });

    it("handles 2FA required response", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("2FA required. Hint: my hint"));

      await useAuthStore.getState().sendAuthCode("12345");

      expect(useAuthStore.getState().authState).toEqual({
        type: "waitPassword",
        hint: "my hint",
      });
      expect(useAuthStore.getState().error).toBeNull();
    });

    it("handles invalid code error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Invalid code"));

      await useAuthStore.getState().sendAuthCode("00000");

      expect(useAuthStore.getState().error).toBe("Error: Invalid code");
    });
  });

  describe("sendPassword", () => {
    it("authenticates with password successfully", async () => {
      const user = { id: 123, firstName: "Test", lastName: "" } as any;
      mockInvoke
        .mockResolvedValueOnce(undefined) // sendPassword
        .mockResolvedValueOnce(user); // getCurrentUser

      await useAuthStore.getState().sendPassword("mypassword");

      expect(mockInvoke).toHaveBeenCalledWith("send_password", {
        password: "mypassword",
      });
      expect(useAuthStore.getState().authState).toEqual({ type: "ready" });
      expect(useAuthStore.getState().currentUser).toEqual(user);
    });

    it("handles wrong password error", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Wrong password"));

      await useAuthStore.getState().sendPassword("wrong");

      expect(useAuthStore.getState().error).toBe("Error: Wrong password");
    });
  });

  describe("checkAuthState", () => {
    it("updates state and gets user when ready", async () => {
      const user = { id: 123, firstName: "Test", lastName: "" } as any;
      mockInvoke
        .mockResolvedValueOnce({ type: "ready" }) // getAuthState
        .mockResolvedValueOnce(user); // getCurrentUser

      await useAuthStore.getState().checkAuthState();

      expect(mockInvoke).toHaveBeenCalledWith("get_auth_state");
      expect(useAuthStore.getState().authState).toEqual({ type: "ready" });
      expect(useAuthStore.getState().currentUser).toEqual(user);
    });

    it("only updates state when not ready", async () => {
      mockInvoke.mockResolvedValueOnce({ type: "waitCode", phoneNumber: "+123" });

      await useAuthStore.getState().checkAuthState();

      expect(useAuthStore.getState().authState).toEqual({
        type: "waitCode",
        phoneNumber: "+123",
      });
      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
  });

  describe("logout", () => {
    it("logs out and resets state", async () => {
      useAuthStore.setState({
        authState: { type: "ready" },
        currentUser: { id: 123, firstName: "Test", lastName: "" } as any,
      });
      mockInvoke.mockResolvedValueOnce(undefined);

      await useAuthStore.getState().logout();

      expect(mockInvoke).toHaveBeenCalledWith("logout");
      expect(useAuthStore.getState().authState).toEqual({ type: "waitPhoneNumber" });
      expect(useAuthStore.getState().currentUser).toBeNull();
    });

    it("handles logout errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Logout failed"));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().error).toBe("Error: Logout failed");
    });
  });

  describe("clearError", () => {
    it("clears the error", () => {
      useAuthStore.setState({ error: "Some error" });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
